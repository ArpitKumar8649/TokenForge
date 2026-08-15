export const TOKENFORGE_API_BASE_URL = "https://tokengate-cqt9ivzs.manus.space";
export const TOKENFORGE_CHAT_COMPLETIONS_URL = `${TOKENFORGE_API_BASE_URL}/v1/chat/completions`;
export const TOKENFORGE_API_KEY_PLACEHOLDER = "tf_live_your_key";

export function buildTokenForgeCurl(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `curl ${TOKENFORGE_CHAT_COMPLETIONS_URL} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "glm-5.2",
    "messages": [{
      "role": "user",
      "content": "Explain vector search in three lines."
    }],
    "stream": true
	  }'`;
}

export function buildTokenForgeJavaScript(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${TOKENFORGE_API_BASE_URL}/v1",
});

const completion = await client.chat.completions.create({
  model: "glm-5.2",
  messages: [{
    role: "user",
    content: "Explain vector search in three lines.",
  }],
});

console.log(completion.choices[0]?.message?.content);`;
}

export function buildTokenForgePython(apiKey = TOKENFORGE_API_KEY_PLACEHOLDER): string {
  return `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="${TOKENFORGE_API_BASE_URL}/v1",
)

completion = client.chat.completions.create(
    model="glm-5.2",
    messages=[{
        "role": "user",
        "content": "Explain vector search in three lines.",
    }],
)

print(completion.choices[0].message.content)`;
}
