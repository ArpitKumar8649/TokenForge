import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const dbSource = readFileSync(resolve(projectRoot, "server/db.ts"), "utf8");
const gatewaySource = readFileSync(resolve(projectRoot, "server/openaiGateway.ts"), "utf8");
const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");
const adminSource = readFileSync(resolve(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("authorized Render NIM proxy swarm", () => {
  it("retains the six authorized endpoints and a hard per-endpoint concurrency ceiling", () => {
    expect(dbSource).toContain("RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS = 7");
    expect(dbSource).toContain("nim-playground-proxy-6.onrender.com");
    expect(dbSource).toContain("lt(renderProxyEndpointMetrics.activeRequests, RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS)");
    expect(dbSource).toContain("activeRequests: sql`${renderProxyEndpointMetrics.activeRequests} + 1`");
  });

  it("tries an eligible Render endpoint before continuing to the existing Claude Opus 5 provider balancer", () => {
    const opusDispatch = gatewaySource.slice(gatewaySource.indexOf("async function forwardDedicatedClaudeOpus5Request"), gatewaySource.indexOf("async function forwardTokenRouterRequest"));
    expect(opusDispatch).toContain("tryForwardClaudeOpus5ThroughRenderSwarm");
    expect(opusDispatch).toContain("const orderedProviders = runtime.providers");
    expect(opusDispatch.indexOf("tryForwardClaudeOpus5ThroughRenderSwarm")).toBeLessThan(opusDispatch.indexOf("const orderedProviders = runtime.providers"));
  });

  it("uses explicit service integration headers and does not inject spoofed browser fingerprints", () => {
    const renderForwarder = gatewaySource.slice(gatewaySource.indexOf("async function tryForwardClaudeOpus5ThroughRenderSwarm"), gatewaySource.indexOf("async function forwardClaudeOpus5"));
    expect(renderForwarder).toContain('"X-TokenForge-Integration": "authorized-render-capacity-router"');
    expect(renderForwarder).not.toContain("User-Agent");
    expect(renderForwarder).not.toContain("Accept-Language");
    expect(renderForwarder).not.toContain("Sec-CH-UA");
  });

  it("provides administrator-only editable settings and a five-second live capacity view", () => {
    expect(routerSource).toContain("renderNimProxySwarmSettings: adminProcedure");
    expect(routerSource).toContain("updateRenderNimProxySwarmSettings: adminProcedure");
    expect(adminSource).toContain("function RenderNimProxySwarmPanel");
    expect(adminSource).toContain("refetchInterval: 5_000");
    expect(adminSource).toContain("Active streams");
    expect(adminSource).toContain("Available slots");
    expect(adminSource).toContain("Save Render bridge");
  });
});
