import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dbSource = readFileSync(path.join(projectRoot, "server/db.ts"), "utf8");
const routerSource = readFileSync(path.join(projectRoot, "server/routers.ts"), "utf8");

describe("DeepSeek V4 Pro credential clear persistence", () => {
  it("accepts an empty pool, retains the provider group, and does not substitute an environment pool", () => {
    expect(dbSource).toContain("function normalizeClaudeOpus5Providers(value: unknown, fallback: ClaudeOpus5ProviderRuntime[], allowEmptyCredentialPools = false)");
    expect(dbSource).toContain("(!allowEmptyCredentialPools && !apiKeys.length)");
    expect(dbSource).toContain("normalizeClaudeOpus5Providers(value, fallback, true)");
    expect(dbSource).toContain("nextProviders.length > MAX_DEEPSEEK_V4PRO_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model)");
    expect(routerSource).toContain("apiKeys: z.array(z.string().trim().max(512)).max(50, \"A provider pool can contain at most 50 API keys\")");
  });
});
