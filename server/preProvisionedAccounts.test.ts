import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(root, "server/routers.ts"), "utf8");
const adminDashboardSource = readFileSync(resolve(root, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("administrator pre-provisioned accounts", () => {
  it("reserves only eligible, normalized email addresses and reports existing users or reservations without creating duplicates", () => {
    const provisioner = dbSource.slice(dbSource.indexOf("export async function preProvisionAccountEmail"), dbSource.indexOf("export async function listAdminPreProvisionedAccounts"));

    expect(provisioner).toContain("const email = normalizeEmail(input.email)");
    expect(provisioner).toContain("isPermanentEmailAddress(email");
    expect(provisioner).toContain('return { kind: "existing_user" as const }');
    expect(provisioner).toContain('return { kind: "already_pre_provisioned" as const');
    expect(provisioner).toContain("introductoryCreditNanos: INTRODUCTORY_CREDIT_NANOS");
  });

  it("claims a pending reservation atomically before recording trusted Discord verification and settling exactly one reserved welcome credit after GitHub resolution", () => {
    const activation = dbSource.slice(dbSource.indexOf("async function activatePreProvisionedAccount"), dbSource.indexOf("function newReferralCode"));
    const claimIndex = activation.indexOf("const claimed = await tx.update(preProvisionedAccounts)");
    const verificationIndex = activation.indexOf("discordVerifiedAt: activatedAt");
    const creditIndex = activation.indexOf("await tx.insert(creditAccounts)");

    expect(claimIndex).toBeGreaterThan(-1);
    expect(verificationIndex).toBeGreaterThan(claimIndex);
    expect(creditIndex).toBeGreaterThan(claimIndex);
    expect(activation).toContain("isNull(preProvisionedAccounts.activatedUserId)");
    expect(activation).toContain("if (Number(claimed[0]?.affectedRows ?? 0) !== 1) return false");
    expect(activation).toContain("tx.insert(accountControls)");
    expect(activation).toContain("onDuplicateKeyUpdate({ set: { discordVerifiedAt: activatedAt } })");
    expect(activation).toContain('referenceId: `pre-provisioned-introductory:${reservation.id}`');
    expect(dbSource).toContain("const preProvisionedActivation = await activatePreProvisionedAccount(userId, email)");
    expect(dbSource).toContain("preProvisionedActivation ? Promise.resolve() : ensureCreditAccount(userId)");
  });

  it("keeps the workflow administrator-only and explains verified GitHub-email activation in the account workspace", () => {
    expect(routerSource).toContain("preProvisionedAccounts: adminProcedure.query");
    expect(routerSource).toContain("preProvisionAccount: adminProcedure");
    expect(adminDashboardSource).toContain("Pre-provision a GitHub account");
    expect(adminDashboardSource).toContain("exact, verified GitHub email match is required for activation");
    expect(adminDashboardSource).toContain("Awaiting verified GitHub login");
  });
});
