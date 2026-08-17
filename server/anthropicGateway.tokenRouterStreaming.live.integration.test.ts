import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
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

const streamingProbeIt = process.env.RUN_TOKENFORGE_CLAUDE_TOKENROUTER_STREAM_PROBE === "true" ? it : it.skip;
const probeOpenId = `tf_probe_tokenrouter_stream_${randomUUID().replace(/-/g, "")}`;
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

describe("TokenForge TokenRouter Claude Anthropic streaming compatibility", () => {
  streamingProbeIt("emits complete Anthropic SSE sequences for Claude Fable 5 and Claude Opus 5", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral TokenRouter Stream Probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;

    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);
    const temporaryKey = await createApiKey(probeUserId, "ephemeral-tokenrouter-stream-probe");
    const baseUrl = (process.env.TOKENFORGE_MESSAGES_PROBE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

    for (const model of ["claude-fable-5", "claude-opus-5"] as const) {
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": temporaryKey.key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 64,
          system: "Reply concisely.",
          messages: [{ role: "user", content: "Reply with exactly OK." }],
          stream: true,
        }),
        signal: AbortSignal.timeout(115_000),
      });

      const stream = await response.text();
      console.info("[TokenForge TokenRouter Claude Messages streaming probe]", {
        model,
        status: response.status,
        endpointAcceptedRequest: response.ok,
        emitsMessageStart: stream.includes("event: message_start"),
        emitsMessageStop: stream.includes("event: message_stop"),
      });
      expect(response.ok, `${model} streaming request failed with HTTP ${response.status}: ${stream.slice(0, 500)}`).toBe(true);
      expect(response.headers.get("content-type")).toContain("text/event-stream");
      expect(stream).toContain("event: message_start");
      expect(stream).toContain("event: message_stop");
    }
  }, 240_000);
});
