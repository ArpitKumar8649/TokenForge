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
    const response = await fetch(`${baseUrl}/v1/messages`, {
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
        system: [{ type: "text", text: "Respond concisely and safely." }],
        messages: [{ role: "user", content: [{ type: "text", text: "Reply with exactly GLM_BRIDGE_OK." }] }],
        tools: [{ name: "Read", description: "Read a repository file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
        stream: false,
      }),
      signal: AbortSignal.timeout(115_000),
    });

    const payload = await response.json().catch(() => null) as { type?: unknown; model?: unknown; content?: unknown } | null;
    console.info("[TokenForge translated GLM 5.3 Messages probe]", {
      status: response.status,
      endpointAcceptedRequest: response.ok,
      responseType: payload?.type,
      returnedModel: payload?.model,
      hasContent: Array.isArray(payload?.content),
    });
    expect(response.ok, `TokenForge /v1/messages rejected the translated GLM 5.3 probe with HTTP ${response.status}: ${JSON.stringify(payload)}`).toBe(true);
    expect(payload).toMatchObject({ type: "message", model: "glm-5.3" });
    expect(Array.isArray(payload?.content)).toBe(true);
  }, 120_000);
});
