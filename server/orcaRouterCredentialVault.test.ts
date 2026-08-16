import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  loadOrcaRouterCredentialSlotCiphertexts: vi.fn(),
  listOrcaRouterCredentialSlotSummaries: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { decryptOrcaRouterCredential, encryptOrcaRouterCredential } from "./orcaRouterCredentialVault";
import { getOrcaRouterCredentialPool, getOrcaRouterSlotRequestCounts, invalidateOrcaRouterCredentialPool, ORCA_ROUTER_CREDENTIAL_POOL_SIZE, resetOrcaRouterSlotRequestCounts, selectNextOrcaRouterCredentialWithSlot } from "./orcaRouterCredentials";

describe("OrcaRouter credential vault and pool", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "credential-vault-test-secret";
    process.env.CLAUDE_OPUS5_API_KEY = "sk-orca-environment-fallback-test-key";
    dbMocks.loadOrcaRouterCredentialSlotCiphertexts.mockReset();
    dbMocks.listOrcaRouterCredentialSlotSummaries.mockReset();
    dbMocks.listOrcaRouterCredentialSlotSummaries.mockResolvedValue([]);
    invalidateOrcaRouterCredentialPool();
    resetOrcaRouterSlotRequestCounts();
  });

  it("encrypts credentials with authenticated random ciphertext that round-trips only server-side", () => {
    const credential = "sk-orca-credential-rotation-example-value";
    const first = encryptOrcaRouterCredential(credential);
    const second = encryptOrcaRouterCredential(credential);

    expect(first.ciphertext).not.toContain(credential);
    expect(first.iv).not.toBe(second.iv);
    expect(first.keyFingerprint).toHaveLength(10);
    expect(decryptOrcaRouterCredential(first)).toBe(credential);
  });

  it("uses all three persisted encrypted slots in deterministic round-robin order", async () => {
    const raw = ["sk-orca-slot-one-key", "sk-orca-slot-two-key", "sk-orca-slot-three-key"];
    dbMocks.loadOrcaRouterCredentialSlotCiphertexts.mockResolvedValue(raw.map((credential, slot) => ({ slot, ...encryptOrcaRouterCredential(credential) })));

    await expect(getOrcaRouterCredentialPool()).resolves.toEqual(raw.map((credential, slot) => ({ credential, slot, poolSize: 3 })));
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[0], slot: 0, poolSize: 3 });
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[1], slot: 1, poolSize: 3 });
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[2], slot: 2, poolSize: 3 });
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[0], slot: 0, poolSize: 3 });
  });

  it("uses all fifteen managed encrypted slots in deterministic round-robin order", async () => {
    const raw = Array.from({ length: ORCA_ROUTER_CREDENTIAL_POOL_SIZE }, (_, slot) => `sk-orca-managed-slot-${slot + 1}-key`);
    dbMocks.loadOrcaRouterCredentialSlotCiphertexts.mockResolvedValue(raw.map((credential, slot) => ({ slot, ...encryptOrcaRouterCredential(credential) })));

    await expect(getOrcaRouterCredentialPool()).resolves.toEqual(raw.map((credential, slot) => ({ credential, slot, poolSize: ORCA_ROUTER_CREDENTIAL_POOL_SIZE })));
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[0], slot: 0, poolSize: ORCA_ROUTER_CREDENTIAL_POOL_SIZE });
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[1], slot: 1, poolSize: ORCA_ROUTER_CREDENTIAL_POOL_SIZE });
    for (let slot = 2; slot < 14; slot += 1) await selectNextOrcaRouterCredentialWithSlot();
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[14], slot: 14, poolSize: ORCA_ROUTER_CREDENTIAL_POOL_SIZE });
    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({ credential: raw[0], slot: 0, poolSize: ORCA_ROUTER_CREDENTIAL_POOL_SIZE });
  });

  it("increments privacy-safe per-slot request totals when a credential is selected", async () => {
    const raw = ["sk-orca-slot-one-key", "sk-orca-slot-two-key", "sk-orca-slot-three-key"];
    dbMocks.loadOrcaRouterCredentialSlotCiphertexts.mockResolvedValue(raw.map((credential, slot) => ({ slot, ...encryptOrcaRouterCredential(credential) })));

    await selectNextOrcaRouterCredentialWithSlot();
    await selectNextOrcaRouterCredentialWithSlot();
    await selectNextOrcaRouterCredentialWithSlot();
    await selectNextOrcaRouterCredentialWithSlot();

    expect(getOrcaRouterSlotRequestCounts()).toEqual([
      { slot: 0, requestCount: 2 },
      { slot: 1, requestCount: 1 },
      { slot: 2, requestCount: 1 },
    ]);
  });

  it("retains the existing environment key as a temporary fallback until all three managed slots exist", async () => {
    dbMocks.loadOrcaRouterCredentialSlotCiphertexts.mockResolvedValue([]);

    await expect(selectNextOrcaRouterCredentialWithSlot()).resolves.toMatchObject({
      credential: "sk-orca-environment-fallback-test-key",
      slot: 0,
      poolSize: 1,
    });
  });
});
