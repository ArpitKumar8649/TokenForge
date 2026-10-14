import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  createApiKey,
  ensureAccountControl,
  ensureCreditAccount,
  getDb,
  getUserByOpenId,
  upsertUser,
} from "./db";
import { accountControls, apiKeys, creditAccounts, creditLedger, usageEvents, users } from "../drizzle/schema";

const glm53ProbeIt = process.env.RUN_TOKENFORGE_GLM53_MESSAGES_PROBE === "true" ? it : it.skip;
const probeOpenId = `tf_probe_glm53_messages_${randomUUID().replace(/-/g, "")}`;
let probeUserId: number | null = null;

async function cleanupProbe() {
  if (probeUserId === null) return;
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable during probe cleanup");
  await db.delete(apiKeys).where(eq(apiKeys.userId, probeUserId));
  await db.delete(usageEvents).where(eq(usageEvents.userId, probeUserId));
  await db.delete(creditLedger).where(eq(creditLedger.userId, probeUserId));
  await db.delete(creditAccounts).where(eq(creditAccounts.userId, probeUserId));
  await db.delete(accountControls).where(eq(accountControls.userId, probeUserId));
  await db.delete(users).where(eq(users.id, probeUserId));
  probeUserId = null;
}

afterEach(async () => {
  await cleanupProbe();
});

describe("TokenForge GLM 5.3 Anthropic Messages compatibility", () => {
  glm53ProbeIt("translates a Claude Code-shaped request through TokenRouter Chat Completions", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral GLM 5.3 Messages Probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;

    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);
    const temporaryKey = await createApiKey(probeUserId, "ephemeral-glm53-messages-probe");
    const baseUrl = (process.env.TOKENFORGE_MESSAGES_PROBE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    const firstResponse = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": temporaryKey.key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14,context-management-2025-06-27",
      },
      body: JSON.stringify({
        model: "glm-5.3",
        max_tokens: 128,
        system: [{ type: "text", text: "Use the supplied tool when the request asks for repository inspection." }],
        messages: [
          { role: "user", content: [{ type: "text", text: "Inspect the repository root using the List tool before replying." }] },
        ],
        tools: [{ name: "List", description: "List a repository directory", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
        stream: true,
      }),
      signal: AbortSignal.timeout(115_000),
    });

    const firstStream = await firstResponse.text();
    const streamFrames = firstStream.split("\n\n").flatMap(frame => {
      const eventLine = frame.split("\n").find(line => line.startsWith("event:"));
      const dataLine = frame.split("\n").find(line => line.startsWith("data:"));
      if (!eventLine || !dataLine) return [];
      try { return [{ event: eventLine.slice(6).trim(), data: JSON.parse(dataLine.slice(5).trim()) as { content_block?: { type?: unknown; id?: unknown; name?: unknown } } }]; } catch { return []; }
    });
    const toolUse = streamFrames.find(frame => frame.event === "content_block_start" && frame.data.content_block?.type === "tool_use")?.data.content_block;
    const firstPayload = { type: "message", model: "glm-5.3", content: toolUse ? [{ type: "tool_use", id: toolUse.id, name: toolUse.name, input: {} }] : [] };
    console.info("[TokenForge GLM 5.3 private continuation first turn]", {
      status: firstResponse.status,
      endpointAcceptedRequest: firstResponse.ok,
      emittedStream: firstResponse.headers.get("content-type")?.includes("text/event-stream") === true,
      issuedToolUse: typeof toolUse?.id === "string",
    });
    expect(firstResponse.ok, `TokenForge /v1/messages rejected the initial GLM 5.3 tool request with HTTP ${firstResponse.status}.`).toBe(true);
    expect(firstResponse.headers.get("content-type")).toContain("text/event-stream");
    expect(typeof toolUse?.id).toBe("string");
    expect(firstStream).not.toContain("reasoning_content");

    const secondResponse = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": temporaryKey.key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14,context-management-2025-06-27",
      },
      body: JSON.stringify({
        model: "glm-5.3",
        max_tokens: 64,
        system: [{ type: "text", text: "Reply concisely after the tool result." }],
        messages: [
          { role: "user", content: [{ type: "text", text: "Inspect the repository root using the List tool before replying." }] },
          { role: "assistant", content: firstPayload?.content ?? [] },
          { role: "user", content: [{ type: "tool_result", tool_use_id: toolUse!.id, content: "README.md\npackage.json\nserver" }] },
        ],
        tools: [{ name: "List", description: "List a repository directory", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
        stream: false,
      }),
      signal: AbortSignal.timeout(115_000),
    });
    const secondPayload = await secondResponse.json().catch(() => null) as { type?: unknown; model?: unknown; content?: unknown } | null;
    console.info("[TokenForge GLM 5.3 private continuation replay]", { status: secondResponse.status, endpointAcceptedRequest: secondResponse.ok, returnedModel: secondPayload?.model });
    expect(secondResponse.ok, `TokenForge /v1/messages rejected the private GLM 5.3 tool continuation with HTTP ${secondResponse.status}: ${JSON.stringify(secondPayload)}`).toBe(true);
    expect(secondPayload).toMatchObject({ type: "message", model: "glm-5.3" });
    expect(JSON.stringify(secondPayload)).not.toContain("reasoning_content");
  }, 120_000);
});
