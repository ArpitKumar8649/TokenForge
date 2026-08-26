import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  ensureAccountControl,
  ensureCreditAccount,
  getDb,
  getUserByOpenId,
  upsertUser,
} from "./db";
import { accountControls, apiKeys, creditAccounts, creditLedger, usageEvents, users } from "../drizzle/schema";
import { forwardProviderRequest, playgroundMessagesForModel, runPlaygroundCompletion } from "./openaiGateway";

const liveProbeIt = process.env.RUN_TOKENFORGE_MANAGED_RESPONSE_QUALITY_PROBE === "true" ? it : it.skip;
const probeOpenId = `tf_probe_quality_${randomUUID().replaceAll("-", "")}`;
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

async function collectStreamContent(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Managed provider returned an empty stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
      content += payload.choices?.[0]?.delta?.content ?? "";
    }
  }
  return content;
}

describe("managed Playground response-quality probe", () => {
  liveProbeIt("returns complete, coherent public text through the same non-streaming path used by Playground", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral managed response-quality probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;
    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);

    const prompts = [
      {
        value: "In exactly two complete sentences, explain why version control matters in software development. Start your answer with the words Version control.",
        expectsVersionControl: true,
      },
      {
        value: "Hlm",
        expectsVersionControl: false,
      },
    ] as const;
    for (const model of ["claude-opus-5", "glm-5.3"] as const) {
      for (const probe of prompts) {
        const result = await runPlaygroundCompletion({
          userId: probeUserId,
          model,
          messages: [{ role: "user", content: probe.value }],
          maxOutputTokens: 160,
          temperature: 0.2,
          sourceIpHash: "managed-response-quality-probe",
        });
        console.info(`[TokenForge managed Playground quality probe] ${JSON.stringify({ model, prompt: probe.value, outputTokens: result.usage.completionTokens, content: result.content.slice(0, 1_000) })}`);
        expect(result.content.trim().length).toBeGreaterThan(10);
        if (probe.expectsVersionControl) expect(result.content).toMatch(/^Version control/i);
        expect(result.usage.completionTokens).toBeGreaterThan(0);
      }
    }
  }, 240_000);

  liveProbeIt("preserves complete coherent text through the Playground streaming SSE path", async () => {
    const prompt = "In exactly two complete sentences, explain why version control matters in software development. Start your answer with the words Version control.";
    for (const model of ["claude-opus-5", "glm-5.3"] as const) {
      const response = await forwardProviderRequest(model, {
        model,
        messages: playgroundMessagesForModel(model, [{ role: "user", content: prompt }]),
        stream: true,
        max_tokens: 192,
        temperature: 0.2,
      }, AbortSignal.timeout(115_000));
      expect(response.ok, `${model} streaming probe returned HTTP ${response.status}`).toBe(true);
      const content = await collectStreamContent(response);
      console.info(`[TokenForge managed Playground streaming quality probe] ${JSON.stringify({ model, content: content.slice(0, 1_000) })}`);
      expect(content.trim().length).toBeGreaterThan(30);
      expect(content).toMatch(/^Version control/i);
    }
  }, 240_000);
});
