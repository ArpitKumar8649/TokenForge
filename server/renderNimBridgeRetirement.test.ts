import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const gatewaySource = readFileSync(path.join(projectRoot, "server/openaiGateway.ts"), "utf8");
const routerSource = readFileSync(path.join(projectRoot, "server/routers.ts"), "utf8");
const adminSource = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("retired Render NVIDIA NIM bridge", () => {
  it("keeps Claude Opus routing on configured provider groups without invoking the Render swarm", () => {
    const dedicatedRoute = gatewaySource.slice(gatewaySource.indexOf("async function forwardDedicatedClaudeOpus5Request"), gatewaySource.indexOf("let claudeFable5ProviderCursor"));
    expect(dedicatedRoute).toContain("const runtime = await getClaudeOpus5RuntimeConfig()");
    expect(dedicatedRoute).not.toContain("tryForwardClaudeOpus5ThroughRenderSwarm(input, signal)");
  });

  it("removes Render bridge procedures and live administrator controls", () => {
    expect(routerSource).not.toContain("renderNimProxySwarmSettings:");
    expect(routerSource).not.toContain("updateRenderNimProxySwarmSettings:");
    expect(adminSource).not.toContain("trpc.admin.renderNimProxySwarmSettings");
    expect(adminSource).not.toContain("trpc.admin.updateRenderNimProxySwarmSettings");
    expect(adminSource).toContain("function RenderNimProxySwarmPanel");
    expect(adminSource).toContain("return null;");
  });
});
