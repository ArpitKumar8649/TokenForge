import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const GLM_TOOL_CONTINUATION_CONTEXT = "TokenForge:GlmToolContinuation:v1";

export type EncryptedGlmToolContinuation = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("GLM tool continuation storage is unavailable");
  return createHash("sha256").update(`${GLM_TOOL_CONTINUATION_CONTEXT}\u0000${secret}`).digest();
}

/** Encrypts opaque upstream reasoning state that must never be exposed to API callers or logs. */
export function encryptGlmToolContinuation(value: string): EncryptedGlmToolContinuation {
  if (!value) throw new Error("GLM tool continuation state must not be empty");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptGlmToolContinuation(value: EncryptedGlmToolContinuation) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
