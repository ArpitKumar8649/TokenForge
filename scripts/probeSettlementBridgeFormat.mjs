const apiKey = process.env.SETTLEMENT_BRIDGE_API_KEY?.trim();
const baseUrl = "https://settlement-bridge-driver-scuba.trycloudflare.com/v1";
const model = "zmf/deepseek/deepseek-v4-pro";

if (!apiKey) {
  throw new Error("SETTLEMENT_BRIDGE_API_KEY is unavailable to the server-only probe.");
}

function headers() {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function visibleTextMarkers(value) {
  const text = typeof value === "string" ? value : "";
  const firstTag = text.match(/^\s*(<[^>\n]{1,80}>)/)?.[1] ?? null;

  return {
    startsWithTag: firstTag,
    hasThinkTag: /<\/?think\b/i.test(text),
    mentionsRequestedToolName: text.includes("add_numbers"),
    mentionsToolCallSyntax: /tool[_ -]?calls?|function[_ -]?call/i.test(text),
  };
}

function structuralMessageSummary(message = {}) {
  const content = typeof message.content === "string" ? message.content : "";
  const reasoning = typeof message.reasoning_content === "string"
    ? message.reasoning_content
    : typeof message.reasoning === "string"
      ? message.reasoning
      : "";
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];

  return {
    messageKeys: Object.keys(message).sort(),
    contentLength: content.length,
    visibleContentMarkers: visibleTextMarkers(content),
    reasoningField: typeof message.reasoning_content === "string"
      ? "reasoning_content"
      : typeof message.reasoning === "string"
        ? "reasoning"
        : null,
    reasoningLength: reasoning.length,
    toolCallCount: toolCalls.length,
    toolCalls: toolCalls.map((toolCall) => ({
      idPresent: typeof toolCall?.id === "string" && toolCall.id.length > 0,
      type: toolCall?.type ?? null,
      functionName: typeof toolCall?.function?.name === "string" ? toolCall.function.name : null,
      argumentsLength: typeof toolCall?.function?.arguments === "string" ? toolCall.function.arguments.length : 0,
    })),
  };
}

async function parseSse(response) {
  if (!response.body) throw new Error("Streaming response did not contain a body.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const chunks = [];
  let visibleContent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta ?? {};
        if (typeof delta.content === "string") visibleContent += delta.content;
        chunks.push({
          deltaKeys: Object.keys(delta).sort(),
          contentLength: typeof delta.content === "string" ? delta.content.length : 0,
          reasoningField: typeof delta.reasoning_content === "string"
            ? "reasoning_content"
            : typeof delta.reasoning === "string"
              ? "reasoning"
              : null,
          reasoningLength: typeof delta.reasoning_content === "string"
            ? delta.reasoning_content.length
            : typeof delta.reasoning === "string"
              ? delta.reasoning.length
              : 0,
          toolCallCount: Array.isArray(delta.tool_calls) ? delta.tool_calls.length : 0,
          finishReason: parsed?.choices?.[0]?.finish_reason ?? null,
        });
      } catch {
        chunks.push({ malformedData: true });
      }
    }
  }

  return { chunks, visibleContent };
}

const toolDefinition = [{
  type: "function",
  function: {
    name: "add_numbers",
    description: "Adds two integers.",
    parameters: {
      type: "object",
      properties: {
        a: { type: "integer" },
        b: { type: "integer" },
      },
      required: ["a", "b"],
      additionalProperties: false,
    },
  },
}];

const nonStreamingResponse = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: headers(),
  signal: AbortSignal.timeout(60_000),
  body: JSON.stringify({
    model,
    stream: false,
    messages: [{ role: "user", content: "Reply with one short greeting." }],
  }),
});

const nonStreamingBody = await nonStreamingResponse.json().catch(() => null);

const streamingResponse = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: headers(),
  signal: AbortSignal.timeout(60_000),
  body: JSON.stringify({
    model,
    stream: true,
    messages: [{ role: "user", content: "Use the available add_numbers tool to add 2 and 3. Do not explain the call." }],
    tools: toolDefinition,
    tool_choice: "auto",
  }),
});

const streamingProbe = streamingResponse.ok
  ? await parseSse(streamingResponse)
  : { chunks: [], visibleContent: "" };
const streamingChunks = streamingProbe.chunks;

const output = {
  nonStreaming: {
    status: nonStreamingResponse.status,
    topLevelKeys: nonStreamingBody && typeof nonStreamingBody === "object" ? Object.keys(nonStreamingBody).sort() : [],
    message: structuralMessageSummary(nonStreamingBody?.choices?.[0]?.message),
    finishReason: nonStreamingBody?.choices?.[0]?.finish_reason ?? null,
  },
  streaming: {
    status: streamingResponse.status,
    chunkCount: streamingChunks.length,
    malformedChunkCount: streamingChunks.filter((chunk) => chunk.malformedData).length,
    contentChunkCount: streamingChunks.filter((chunk) => chunk.contentLength > 0).length,
    visibleContentMarkers: visibleTextMarkers(streamingProbe.visibleContent),
    reasoningChunkCount: streamingChunks.filter((chunk) => chunk.reasoningLength > 0).length,
    toolCallChunkCount: streamingChunks.filter((chunk) => chunk.toolCallCount > 0).length,
    finishReasons: [...new Set(streamingChunks.map((chunk) => chunk.finishReason).filter(Boolean))],
    sampleShapes: streamingChunks.slice(0, 12),
  },
};

console.log(JSON.stringify(output, null, 2));
