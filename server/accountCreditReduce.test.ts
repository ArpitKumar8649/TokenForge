import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import { setAdminAccountCredit, writeAuditEvent } from "./db";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    setAdminAccountCredit: vi.fn(),
    writeAuditEvent: vi.fn(),
  };
});

describe("Admin set/reduce account credit functionality", () => {
  const adminUser = {
    id: 1,
    openId: "admin-open-id",
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    isAdminSession: true,
  };

  const regularUser = {
    id: 2,
    openId: "user-open-id",
    name: "Regular User",
    email: "user@example.com",
    role: "user",
    isAdminSession: false,
  };

  const makeContext = (user?: any) => ({
    ctx: {
      user: user ?? null,
      session: user ? { userId: user.id } : null,
      req: {} as any,
      res: {} as any,
    },
  });

  it("rejects unauthorized non-admin users from setting/reducing account credit", async () => {
    const caller = appRouter.createCaller(makeContext(regularUser).ctx);
    await expect(
      caller.admin.setAccountCredit({
        userId: 10,
        targetAmountUsd: 15.5,
        balanceType: "bundle",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin to set or reduce bundle credits to a specified amount", async () => {
    vi.mocked(setAdminAccountCredit).mockResolvedValue({
      targetAmountNanos: 15_500_000_000,
      diffNanos: -10_000_000_000,
      balanceNanos: 15_500_000_000,
      paygBalanceNanos: 0,
      balanceType: "bundle",
    });

    const caller = appRouter.createCaller(makeContext(adminUser).ctx);
    const result = await caller.admin.setAccountCredit({
      userId: 10,
      targetAmountUsd: 15.5,
      balanceType: "bundle",
      note: "Reduced balance upon request",
    });

    expect(result).toEqual({
      targetAmountNanos: 15_500_000_000,
      diffNanos: -10_000_000_000,
      balanceNanos: 15_500_000_000,
      paygBalanceNanos: 0,
      balanceType: "bundle",
    });
    expect(setAdminAccountCredit).toHaveBeenCalledWith({
      userId: 10,
      targetAmountNanos: 15_500_000_000,
      actorUserId: 1,
      balanceType: "bundle",
      note: "Reduced balance upon request",
    });
  });

  it("allows admin to set or reduce PAYG balance to a specified amount (e.g. 0.00)", async () => {
    vi.mocked(setAdminAccountCredit).mockResolvedValue({
      targetAmountNanos: 0,
      diffNanos: -5_000_000_000,
      balanceNanos: 20_000_000_000,
      paygBalanceNanos: 0,
      balanceType: "payg",
    });

    const caller = appRouter.createCaller(makeContext(adminUser).ctx);
    const result = await caller.admin.setAccountCredit({
      userId: 10,
      targetAmountUsd: 0,
      balanceType: "payg",
    });

    expect(result).toEqual({
      targetAmountNanos: 0,
      diffNanos: -5_000_000_000,
      balanceNanos: 20_000_000_000,
      paygBalanceNanos: 0,
      balanceType: "payg",
    });
    expect(setAdminAccountCredit).toHaveBeenCalledWith({
      userId: 10,
      targetAmountNanos: 0,
      actorUserId: 1,
      balanceType: "payg",
      note: undefined,
    });
  });
});
