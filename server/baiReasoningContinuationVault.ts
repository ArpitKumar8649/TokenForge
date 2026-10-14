import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const BAI_REASONING_CONTINUATION_VAULT_CONTEXT = "TokenForge:BaiReasoningContinuationVault:v1";

export type EncryptedBaiReasoningContinuation = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("TokenForge b.ai continuation vault is unavailable");
  return createHash("sha256").update(`${BAI_REASONING_CONTINUATION_VAULT_CONTEXT}\u0000${secret}`).digest();
}

export function encryptBaiReasoningContinuation(reasoningContent: string): EncryptedBaiReasoningContinuation {
  if (!reasoningContent.trim()) throw new Error("b.ai continuation reasoning is empty");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(reasoningContent, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptBaiReasoningContinuation(value: EncryptedBaiReasoningContinuation): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  const reasoningContent = Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
  if (!reasoningContent.trim()) throw new Error("b.ai continuation reasoning is empty");
  return reasoningContent;
}
