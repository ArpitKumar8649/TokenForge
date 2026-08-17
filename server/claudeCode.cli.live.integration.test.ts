import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  createApiKey,
  ensureAccountControl,
  ensureCreditAccount,
  getDb,
  getUserByOpenId,
  upsertUser,
} from "./db";
import { accountControls, apiKeys, creditAccounts, creditLedger, usageEvents, users } from "../drizzle/schema";

const execFileAsync = promisify(execFile);
const cliProbeIt = process.env.RUN_TOKENFORGE_CLAUDE_CODE_CLI_PROBE === "true" ? it : it.skip;
const probeOpenId = `tf_probe_claude_code_cli_${randomUUID().replace(/-/g, "")}`;
let probeUserId: number | null = null;
let claudeConfigDir: string | null = null;

async function cleanupProbe() {
  if (claudeConfigDir) {
    await rm(claudeConfigDir, { force: true, recursive: true }).catch(() => undefined);
    claudeConfigDir = null;
  }
  if (probeUserId === null) return;
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable during Claude Code CLI probe cleanup");
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

describe("Claude Code CLI TokenForge gateway compatibility", () => {
  cliProbeIt("runs Claude Code against the published TokenForge Claude Messages route", async () => {
    await upsertUser({
      openId: probeOpenId,
      name: "Ephemeral Claude Code CLI Probe",
      email: null,
      loginMethod: "probe",
      role: "user",
    });
    const user = await getUserByOpenId(probeOpenId);
    expect(user).toBeTruthy();
    probeUserId = user!.id;
    await ensureAccountControl(probeUserId);
    await ensureCreditAccount(probeUserId);
    const temporaryKey = await createApiKey(probeUserId, "ephemeral-claude-code-cli-probe");
    const baseUrl = (process.env.TOKENFORGE_CLAUDE_CODE_PROBE_BASE_URL ?? "https://tokengate-cqt9ivzs.manus.space").replace(/\/$/, "");
    const model = process.env.TOKENFORGE_CLAUDE_CODE_PROBE_MODEL ?? "claude-opus-5";
    claudeConfigDir = `/tmp/tokenforge-claude-code-${randomUUID()}`;

    const { stdout, stderr } = await execFileAsync(
      "claude",
      ["-p", "Reply with exactly: TOKENFORGE_CLAUDE_CODE_OK", "--output-format", "json"],
      {
        cwd: "/tmp",
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: temporaryKey.key,
          ANTHROPIC_BASE_URL: baseUrl,
          ANTHROPIC_DEFAULT_OPUS_MODEL: model,
          ANTHROPIC_MODEL: model,
          ANTHROPIC_SMALL_FAST_MODEL: model,
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
          CLAUDE_CONFIG_DIR: claudeConfigDir,
        },
        maxBuffer: 2 * 1024 * 1024,
        timeout: 120_000,
      },
    );

    const parsed = JSON.parse(stdout) as { result?: unknown; subtype?: unknown; is_error?: unknown };
    console.info("[TokenForge actual Claude Code CLI probe]", {
      exitSucceeded: true,
      hasExpectedResult: typeof parsed.result === "string" && parsed.result.includes("TOKENFORGE_CLAUDE_CODE_OK"),
      isError: parsed.is_error === true,
      model,
      stderrPresent: stderr.trim().length > 0,
      subtype: parsed.subtype ?? null,
    });
    expect(parsed.is_error).not.toBe(true);
    expect(parsed.result).toContain("TOKENFORGE_CLAUDE_CODE_OK");
  }, 130_000);
});
