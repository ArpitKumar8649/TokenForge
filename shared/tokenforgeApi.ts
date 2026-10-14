import { PUBLIC_ORIGIN } from "./const";
export const TOKENFORGE_API_BASE_URL = PUBLIC_ORIGIN;
export const TOKENFORGE_MESSAGES_URL = `${TOKENFORGE_API_BASE_URL}/v1/messages`;
export const TOKENFORGE_CHAT_COMPLETIONS_URL = `${TOKENFORGE_API_BASE_URL}/v1/chat/completions`;
export const TOKENFORGE_API_KEY_PLACEHOLDER = "tf_live_your_key";

export function buildTokenForgeCurl(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `curl ${TOKENFORGE_MESSAGES_URL} \\
  -H "x-api-key: ${apiKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "glm-5.3",
    "max_tokens": 1024,
    "messages": [{
      "role": "user",
      "content": "Explain vector search in three lines."
    }]
  }'`;
}

export function buildTokenForgeJavaScript(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "${apiKey}",
  baseURL: "${TOKENFORGE_API_BASE_URL}",
});

const message = await client.messages.create({
  model: "glm-5.3",
  max_tokens: 1024,
  messages: [{
    role: "user",
    content: "Explain vector search in three lines.",
  }],
});

console.log(message.content[0]?.text);`;
}

export function buildTokenForgePython(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `import anthropic

client = anthropic.Anthropic(
    api_key="${apiKey}",
    base_url="${TOKENFORGE_API_BASE_URL}",
)

message = client.messages.create(
    model="glm-5.3",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": "Explain vector search in three lines.",
    }],
)

print(message.content[0].text)`;
}

export function buildTokenForgeClaudeCode(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `export ANTHROPIC_BASE_URL="${TOKENFORGE_API_BASE_URL}"
export ANTHROPIC_API_KEY="${apiKey}"
claude`;
}

