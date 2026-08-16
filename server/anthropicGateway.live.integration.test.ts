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

const runEndpointProbe = process.env.RUN_TOKENFORGE_MESSAGES_MAX_PROBE === "true";
const endpointIt = runEndpointProbe ? it : it.skip;
const probeOpenId = `tf_probe_messages_${randomUUID().replace(/-/g, "")}`;
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

describe("TokenForge Anthropic Messages Kimi K3 max-reasoning compatibility", () => {
  endpointIt("accepts a live `/v1/messages` request carrying exact max reasoning effort, then removes every probe artifact", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral Messages Probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;

    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);
    const temporaryKey = await createApiKey(probeUserId, "ephemeral-max-reasoning-probe");
    const baseUrl = (process.env.TOKENFORGE_MESSAGES_PROBE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": temporaryKey.key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "kimi-k3",
        max_tokens: 8,
        messages: [{ role: "user", content: "Reply with OK." }],
        reasoning_effort: "max",
        stream: false,
      }),
      signal: AbortSignal.timeout(115_000),
    });

    console.info("[TokenForge Messages max reasoning probe]", {
      requestedReasoningEffort: "max",
      status: response.status,
      endpointAcceptedRequest: response.ok,
      note: "The current Anthropic bridge accepts unknown fields but does not yet forward reasoning_effort upstream.",
    });
    expect(response.ok, `TokenForge /v1/messages rejected the minimal Kimi K3 probe with HTTP ${response.status}`).toBe(true);
  }, 120_000);
});
