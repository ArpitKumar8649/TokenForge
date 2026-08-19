import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  createApiKey,
  ensureAccountControl,
  ensureCreditAccount,
  getDb,
  getUserByOpenId,
  upsertUser,
} from "./db";
import { accountControls, apiKeys, creditAccounts, creditLedger, usageEvents, users } from "../drizzle/schema";

const nativeProbeIt = process.env.RUN_TOKENFORGE_CLAUDE_OPUS5_NATIVE_PROBE === "true" ? it : it.skip;
const probeOpenId = `tf_probe_opus5_native_${randomUUID().replace(/-/g, "")}`;
const probePrompt = process.env.TOKENFORGE_CLAUDE_OPUS5_PROBE_PROMPT ?? "Reply with exactly OK.";
const assertPublicIdentity = process.env.TOKENFORGE_CLAUDE_OPUS5_ASSERT_PUBLIC_IDENTITY === "true";
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

describe("TokenForge Claude Opus 5 Anthropic Messages compatibility", () => {
  nativeProbeIt("translates a Claude Code-style request through the configured compatible Chat Completions route", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral Claude Opus 5 Native Probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;

    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);
    const temporaryKey = await createApiKey(probeUserId, "ephemeral-claude-opus5-native-probe");
    const baseUrl = (process.env.TOKENFORGE_MESSAGES_PROBE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": temporaryKey.key,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 256,
        system: [{ type: "text", text: "Be concise." }],
        messages: [{ role: "user", content: [{ type: "text", text: probePrompt }] }],
        ...(assertPublicIdentity ? {} : { tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }] }),
        stream: false,
      }),
      signal: AbortSignal.timeout(115_000),
    });

    const payload = await response.json().catch(() => null) as { type?: unknown; model?: unknown; content?: unknown; error?: { message?: unknown } } | null;
    const publicText = Array.isArray(payload?.content)
      ? payload.content
        .filter((block): block is { type: unknown; text: unknown } => Boolean(block) && typeof block === "object" && !Array.isArray(block) && "type" in block && "text" in block)
        .filter(block => block.type === "text" && typeof block.text === "string")
        .map(block => block.text)
        .join("\n")
      : null;
    console.info("[TokenForge translated Claude Opus 5 Messages probe]", {
      status: response.status,
      endpointAcceptedRequest: response.ok,
      responseType: payload?.type,
      returnedModel: payload?.model,
      providerError: typeof payload?.error?.message === "string" ? payload.error.message : null,
      hasContent: Array.isArray(payload?.content),
      publicText: publicText?.slice(0, 1_000) ?? null,
    });
    expect(response.ok, `TokenForge /v1/messages rejected the native Claude Opus 5 probe with HTTP ${response.status}: ${JSON.stringify(payload)}`).toBe(true);
    expect(payload).toMatchObject({ type: "message", model: "claude-opus-5" });
    expect(Array.isArray(payload?.content)).toBe(true);
    if (assertPublicIdentity) {
      expect(publicText).toContain("Claude Opus 5, available through TokenForge");
      expect(publicText).not.toMatch(/nemotron|lightning/i);
    }
  }, 120_000);
});
