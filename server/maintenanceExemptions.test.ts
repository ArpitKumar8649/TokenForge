import { describe, expect, it, beforeEach } from "vitest";
import {
  getPlatformMaintenanceExemptions,
  setPlatformMaintenanceExemption,
  removePlatformMaintenanceExemption,
  isUserExemptFromPlatformMaintenance,
  fallbackPlatformSettings,
} from "./db";

describe("Global Inference Maintenance Exemption System", () => {
  beforeEach(() => {
    fallbackPlatformSettings.set("platform_maintenance_exemptions_v1", {
      value: "[]",
      updatedAt: new Date(),
      updatedByUserId: null,
    });
  });

  it("adds an allowed email exemption and bypasses maintenance", async () => {
    await setPlatformMaintenanceExemption("VIP@Example.COM", "allowed", 1);

    const list = await getPlatformMaintenanceExemptions();
    const entry = list.find(e => e.email === "vip@example.com");
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("allowed");

    const isExempt = await isUserExemptFromPlatformMaintenance("vip@example.com");
    expect(isExempt).toBe(true);

    const isCaseInsensitiveExempt = await isUserExemptFromPlatformMaintenance("VIP@EXAMPLE.COM");
    expect(isCaseInsensitiveExempt).toBe(true);

    const nonExempt = await isUserExemptFromPlatformMaintenance("other@example.com");
    expect(nonExempt).toBe(false);
  });

  it("restricts an exempted user so maintenance applies to them again", async () => {
    await setPlatformMaintenanceExemption("vip@example.com", "allowed", 1);
    expect(await isUserExemptFromPlatformMaintenance("vip@example.com")).toBe(true);

    // Click "Restrict"
    await setPlatformMaintenanceExemption("vip@example.com", "restricted", 1);

    const list = await getPlatformMaintenanceExemptions();
    const entry = list.find(e => e.email === "vip@example.com");
    expect(entry).toBeDefined();
    expect(entry?.status).toBe("restricted");

    // Maintenance now applies to them
    expect(await isUserExemptFromPlatformMaintenance("vip@example.com")).toBe(false);

    // Click "Allow" to restore bypass
    await setPlatformMaintenanceExemption("vip@example.com", "allowed", 1);
    expect(await isUserExemptFromPlatformMaintenance("vip@example.com")).toBe(true);
  });

  it("removes an exemption completely", async () => {
    await setPlatformMaintenanceExemption("tester@example.com", "allowed", 1);
    expect(await isUserExemptFromPlatformMaintenance("tester@example.com")).toBe(true);

    await removePlatformMaintenanceExemption("tester@example.com", 1);
    const list = await getPlatformMaintenanceExemptions();
    expect(list.find(e => e.email === "tester@example.com")).toBeUndefined();
    expect(await isUserExemptFromPlatformMaintenance("tester@example.com")).toBe(false);
  });

  it("unconditionally exempts administrators from global maintenance", async () => {
    // Admin email
    expect(await isUserExemptFromPlatformMaintenance("admin@gmail.com")).toBe(true);
    expect(await isUserExemptFromPlatformMaintenance("Admin@Gmail.Com")).toBe(true);

    // kumararpit9468@gmail.com is a regular user (not admin)
    expect(await isUserExemptFromPlatformMaintenance("kumararpit9468@gmail.com")).toBe(false);

    // Admin role in user object or session
    expect(await isUserExemptFromPlatformMaintenance({ role: "admin", email: "admin@corp.internal" })).toBe(true);
    expect(await isUserExemptFromPlatformMaintenance({ isAdminSession: true })).toBe(true);
  });
});
