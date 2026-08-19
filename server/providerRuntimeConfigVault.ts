import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PROVIDER_RUNTIME_CONFIG_CONTEXT = "TokenForge:ProviderRuntimeConfigVault:v1";

export type EncryptedProviderRuntimeConfig = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("TokenForge provider configuration vault is unavailable");
  return createHash("sha256").update(`${PROVIDER_RUNTIME_CONFIG_CONTEXT}\u0000${secret}`).digest();
}

export function encryptProviderRuntimeConfig(value: unknown): EncryptedProviderRuntimeConfig {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const plaintext = JSON.stringify(value);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64"), iv: iv.toString("base64"), authTag: cipher.getAuthTag().toString("base64") };
}

export function decryptProviderRuntimeConfig(value: EncryptedProviderRuntimeConfig): unknown {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8"));
}
