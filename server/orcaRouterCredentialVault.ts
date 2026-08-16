import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const CREDENTIAL_VAULT_CONTEXT = "TokenForge:OrcaRouterCredentialVault:v1";

export type EncryptedCredential = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyFingerprint: string;
};

function encryptionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("TokenForge credential vault is unavailable");
  return createHash("sha256").update(`${CREDENTIAL_VAULT_CONTEXT}\u0000${secret}`).digest();
}

export function encryptOrcaRouterCredential(credential: string): EncryptedCredential {
  const normalized = credential.trim();
  if (!normalized) throw new Error("Credential must not be empty");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyFingerprint: createHash("sha256").update(normalized).digest("hex").slice(-10),
  };
}

export function decryptOrcaRouterCredential(value: Pick<EncryptedCredential, "ciphertext" | "iv" | "authTag">) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
