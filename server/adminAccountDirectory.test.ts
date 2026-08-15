import { describe, expect, it } from "vitest";
import { normalizeAdminAccountDirectoryInput } from "./db";

describe("normalizeAdminAccountDirectoryInput", () => {
  it("bounds pagination and trims an account query before it reaches the database", () => {
    expect(normalizeAdminAccountDirectoryInput({ page: -3, pageSize: 200, search: "  arpit@example.com  ", status: "flagged" })).toEqual({
      page: 1,
      pageSize: 50,
      search: "arpit@example.com",
      status: "flagged",
    });
  });

  it("uses a compact directory page by default", () => {
    expect(normalizeAdminAccountDirectoryInput()).toEqual({ page: 1, pageSize: 10, search: "", status: "all" });
  });
});
