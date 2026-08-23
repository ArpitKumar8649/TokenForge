import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_PROVIDER_ERROR_MESSAGE, publicProviderErrorMessage, upstreamError } from "./openaiGateway";

const projectRoot = resolve(import.meta.dirname, "..");
const dbSource = readFileSync(resolve(projectRoot, "server/db.ts"), "utf8");
const gatewaySource = readFileSync(resolve(projectRoot, "server/openaiGateway.ts"), "utf8");
const routerSource = readFileSync(resolve(projectRoot, "server/routers.ts"), "utf8");
const adminSource = readFileSync(resolve(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("authorized Render NIM proxy swarm", () => {
  it("keeps credential-redacted upstream diagnostics for administrator logs while callers receive a neutral envelope", () => {
    expect(upstreamError({ error: { message: "upstream 500: Service temporarily overloaded; Bearer sk-super-secret-token" } }, 502))
      .toBe("HTTP 502 — upstream 500: Service temporarily overloaded; Bearer [redacted]");
    expect(publicProviderErrorMessage(502)).toBe(PUBLIC_PROVIDER_ERROR_MESSAGE);
  });

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

  it("holds each Render lease through complete response consumption and gives cold starts a 120-second header window", () => {
    const renderForwarder = gatewaySource.slice(gatewaySource.indexOf("async function tryForwardClaudeOpus5ThroughRenderSwarm"), gatewaySource.indexOf("async function forwardClaudeOpus5"));
    expect(gatewaySource).toContain("RENDER_NIM_PROXY_RESPONSE_START_TIMEOUT_MS = 120_000");
    expect(renderForwarder).toContain("setTimeout(() => responseStartAborter.abort(), RENDER_NIM_PROXY_RESPONSE_START_TIMEOUT_MS)");
    expect(renderForwarder).toContain("wrapRenderResponseWithLease(response, endpoint.id, signal)");
    expect(gatewaySource).toContain('finalize({ kind: "success" })');
    expect(gatewaySource).toContain('finalize({ kind: "cancelled" })');
    expect(gatewaySource).toContain('failureKind: "stream"');
    expect(renderForwarder).not.toContain("AbortSignal.timeout(55_000)");
  });

  it("uses a clearable two-minute response-start deadline for every dedicated model provider", () => {
    expect(gatewaySource).toContain("PROVIDER_RESPONSE_START_TIMEOUT_MS = 120_000");
    expect(gatewaySource).toContain("function createResponseStartDeadline");
    expect(gatewaySource).toContain("responseStart.clear()");
    expect(gatewaySource).not.toContain("AbortSignal.timeout(50_000)");
  });

  it("persists raw credential-redacted status and reason diagnostics without counting client cancellation as upstream failure", () => {
    expect(dbSource).toContain("lastHttpStatus");
    expect(dbSource).toContain("lastFailureKind");
    expect(dbSource).toContain("lastFailureMessage");
    expect(dbSource).toContain("sanitizeRenderNimProxyFailureMessage");
    expect(dbSource).not.toContain(".slice(0, 512)");
    expect(dbSource).toContain('const isFailure = outcome.kind === "failure"');
    expect(gatewaySource).toContain("renderedHttpFailureDiagnostic(response.status, rawBody)");
    expect(gatewaySource).toContain('failureKind: timeout ? "timeout" : "network"');
    expect(gatewaySource).toContain("publicProviderErrorMessage(upstream.status)");
  });

  it("records raw credential-redacted Claude Opus and DeepSeek failure attempts with their originating provider groups", () => {
    expect(dbSource).toContain("claudeOpus5FailureLogs");
    expect(dbSource).toContain("recordClaudeOpus5FailureLog");
    expect(dbSource).toContain("recordDeepseekV4ProFailureLog");
    expect(dbSource).toContain("getRecentClaudeOpus5FailureLogs");
    expect(dbSource).toContain("getRecentDeepseekV4ProFailureLogs");
    expect(dbSource).toContain("sourceLabel: sanitizeRenderNimProxyFailureMessage(input.sourceLabel)");
    expect(dbSource).toContain("sourceType: \"render\"");
    expect(gatewaySource).toContain("sourceType: \"provider\"");
    expect(gatewaySource).toContain("wrapClaudeOpus5ProviderResponseWithFailureLog");
    expect(gatewaySource).toContain("wrapDeepseekV4ProProviderResponseWithFailureLog");
    expect(routerSource).toContain("claudeOpus5FailureLogs: adminProcedure");
    expect(routerSource).toContain("deepseekV4ProFailureLogs: adminProcedure");
    expect(adminSource).toContain("Claude Opus 5 failure history");
    expect(adminSource).toContain("Render endpoint");
    expect(adminSource).toContain("Provider group");
    expect(adminSource).toContain("DeepSeek V4 Pro failure history");
    expect(adminSource).toContain("raw credential-redacted HTTP status/reason diagnostics");
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
    expect(adminSource).toContain("Active full responses / streams");
    expect(adminSource).toContain("Available slots");
    expect(adminSource).toContain("Last failure");
    expect(adminSource).toContain("active full-response leases");
    expect(adminSource).toContain("Save Render bridge");
  });
});
