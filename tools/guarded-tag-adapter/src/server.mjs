import http from "node:http";
import { randomUUID } from "node:crypto";
import { GuardedTagError, parseGuardedResponse } from "./guardedToolTags.mjs";

const port = Number.parseInt(process.env.GUARDED_ADAPTER_PORT ?? "39300", 10);
const clientToken = process.env.GUARDED_ADAPTER_CLIENT_TOKEN?.trim();
const upstreamKey = process.env.SETTLEMENT_BRIDGE_API_KEY?.trim();
const upstreamBaseUrl = "https://settlement-bridge-driver-scuba.trycloudflare.com/v1";
const upstreamModel = "zmf/deepseek/deepseek-v4-pro";
const allowedToolNames = new Set((process.env.GUARDED_ALLOWED_TOOLS ?? "Read").split(",").map((name) => name.trim()).filter(Boolean));
const maxRequestBytes = 1_500_000;

if (!clientToken || !upstreamKey) throw new Error("Required server-only adapter secrets are unavailable.");

const protocol = `<guarded_tool_protocol>
When a tool is needed, output exactly one block and no other text:
<tool_call><name>TOOL_NAME</name><parameters>{"argument":"value"}</parameters></tool_call>
When a prior <observation> exists and you can answer, output exactly:
<final>user-facing answer</final>
Never narrate a tool call. Never repeat a tool call. Never use markdown fences.
</guarded_tool_protocol>`;

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify(body));
}

function sse(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function normalizeText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((block) => {
      if (block?.type === "text") return block.text ?? "";
      if (block?.type === "tool_result") return `<observation>${typeof block.content === "string" ? block.content : ""}</observation>`;
      if (block?.type === "tool_use") return `<prior_tool_call name="${block.name ?? ""}">${JSON.stringify(block.input ?? {})}</prior_tool_call>`;
      return "";
    })
    .join("\n");
}

function makeAllowedTools(requestTools) {
  const output = {};
  for (const tool of Array.isArray(requestTools) ? requestTools : []) {
    if (!tool || typeof tool.name !== "string" || !allowedToolNames.has(tool.name)) continue;
    if (!tool.input_schema || typeof tool.input_schema !== "object") continue;
    output[tool.name] = { inputSchema: tool.input_schema };
  }
  return output;
}

function buildUpstreamMessages(body, allowedTools) {
  const systemInput = normalizeText(body.system);
  const toolDescriptions = Object.entries(allowedTools)
    .map(([name, definition]) => `<tool name="${name}">${JSON.stringify(definition.inputSchema)}</tool>`)
    .join("\n");
  const messages = [
    { role: "system", content: `${systemInput}\n\n${protocol}\n<allowed_tools>\n${toolDescriptions}\n</allowed_tools>` },
  ];
  for (const message of Array.isArray(body.messages) ? body.messages : []) {
    if (message?.role !== "user" && message?.role !== "assistant") continue;
    messages.push({ role: message.role, content: normalizeText(message.content) });
  }
  return messages;
}

async function readBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxRequestBytes) throw new GuardedTagError("REQUEST_TOO_LARGE", "Request exceeds the local adapter limit.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function requestUpstream(messages) {
  const response = await fetch(`${upstreamBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${upstreamKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({ model: upstreamModel, stream: false, temperature: 0, messages }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.choices?.[0]?.message?.content !== "string") {
    console.warn("Upstream response shape:", {
      status: response.status,
      topLevelKeys: body && typeof body === "object" ? Object.keys(body).sort() : [],
      choiceKeys: body?.choices?.[0] && typeof body.choices[0] === "object" ? Object.keys(body.choices[0]).sort() : [],
      messageKeys: body?.choices?.[0]?.message && typeof body.choices[0].message === "object" ? Object.keys(body.choices[0].message).sort() : [],
    });
    throw new GuardedTagError("UPSTREAM_INVALID", "Upstream did not return a usable text response.");
  }
  return body.choices[0].message.content;
}

function streamAnthropicResponse(response, parsed) {
  const id = `msg_${randomUUID().replaceAll("-", "")}`;
  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
  sse(response, "message_start", { type: "message_start", message: { id, type: "message", role: "assistant", content: [], model: upstreamModel, stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } });

  if (parsed.type === "tool_use") {
    const toolId = `toolu_${randomUUID().replaceAll("-", "")}`;
    sse(response, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: toolId, name: parsed.name, input: {} } });
    sse(response, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(parsed.input) } });
    sse(response, "content_block_stop", { type: "content_block_stop", index: 0 });
    sse(response, "message_delta", { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 0 } });
  } else {
    sse(response, "content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
    sse(response, "content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: parsed.text } });
    sse(response, "content_block_stop", { type: "content_block_stop", index: 0 });
    sse(response, "message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } });
  }
  sse(response, "message_stop", { type: "message_stop" });
  response.end();
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method !== "POST" || request.url !== "/v1/messages") return sendJson(response, 404, { type: "error", error: { type: "not_found_error", message: "Not found." } });
    if (request.headers["x-api-key"] !== clientToken) return sendJson(response, 401, { type: "error", error: { type: "authentication_error", message: "Unauthorized." } });
    const body = await readBody(request);
    const allowedTools = makeAllowedTools(body.tools);
    if (Object.keys(allowedTools).length === 0) return sendJson(response, 400, { type: "error", error: { type: "invalid_request_error", message: "No allowed tool schema was supplied." } });
    const raw = await requestUpstream(buildUpstreamMessages(body, allowedTools));
    const parsed = parseGuardedResponse(raw, allowedTools);
    streamAnthropicResponse(response, parsed);
  } catch (error) {
    console.warn("Guarded adapter rejected response:", error instanceof GuardedTagError ? error.code : "INTERNAL_ERROR");
    const message = error instanceof GuardedTagError ? error.message : "Local guarded adapter request failed.";
    sendJson(response, 422, { type: "error", error: { type: "invalid_request_error", message } });
  }
});

server.listen(port, "127.0.0.1", () => console.log(`Guarded adapter listening on 127.0.0.1:${port}`));
