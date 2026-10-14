import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const GLM_TOOL_CONTINUATION_VAULT_CONTEXT = "TokenForge:GlmToolContinuationVault:v1";

export type GlmPrivateToolContinuation = {
  role: "assistant";
  content: string | null;
  reasoning_content: string;
  tool_calls: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type EncryptedGlmToolContinuation = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("TokenForge GLM continuation vault is unavailable");
  return createHash("sha256").update(`${GLM_TOOL_CONTINUATION_VAULT_CONTEXT}\u0000${secret}`).digest();
}

export function encryptGlmToolContinuation(value: GlmPrivateToolContinuation): EncryptedGlmToolContinuation {
  if (!value.reasoning_content.trim() || value.tool_calls.length < 1) throw new Error("GLM continuation state is incomplete");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptGlmToolContinuation(value: EncryptedGlmToolContinuation): GlmPrivateToolContinuation {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  const parsed = JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8")) as Partial<GlmPrivateToolContinuation>;
  if (parsed.role !== "assistant" || typeof parsed.reasoning_content !== "string" || !parsed.reasoning_content.trim() || !Array.isArray(parsed.tool_calls)) {
    throw new Error("GLM continuation state is invalid");
  }
  const toolCalls = parsed.tool_calls.filter((call): call is GlmPrivateToolContinuation["tool_calls"][number] =>
    Boolean(call && typeof call.id === "string" && call.id && call.type === "function" && typeof call.function?.name === "string" && typeof call.function?.arguments === "string"),
  );
  if (!toolCalls.length) throw new Error("GLM continuation state has no tool calls");
  return { role: "assistant", content: typeof parsed.content === "string" ? parsed.content : null, reasoning_content: parsed.reasoning_content, tool_calls: toolCalls };
}
