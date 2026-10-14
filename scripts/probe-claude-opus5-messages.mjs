const baseUrl = process.env.CLAUDE_OPUS5_BASE_URL;
const apiKey = process.env.CLAUDE_OPUS5_API_KEY;
const model = process.env.CLAUDE_OPUS5_MODEL;

if (!baseUrl || !apiKey || !model) {
  throw new Error("Claude Opus 5 provider configuration is unavailable to the server-side probe.");
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/messages`, {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with exactly: ready" }],
  }),
  signal: AbortSignal.timeout(90_000),
});

const text = await response.text();
let payload;
try {
  payload = JSON.parse(text);
} catch {
  payload = null;
}

console.log(JSON.stringify({
  status: response.status,
  contentType: response.headers.get("content-type"),
  isNativeMessagesShape: Boolean(payload && typeof payload === "object" && payload.type === "message" && Array.isArray(payload.content)),
  errorType: payload && typeof payload === "object" && payload.error && typeof payload.error === "object" ? payload.error.type ?? null : null,
  errorMessage: payload && typeof payload === "object" && payload.error && typeof payload.error === "object" ? payload.error.message ?? null : null,
}, null, 2));
