import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("dynamic Claude provider API-key pool controls", () => {
  it("provides add and remove controls for both encrypted Claude provider pools", () => {
    expect(source).toContain("function DynamicProviderKeyPool");
    expect(source).toContain('providerName="Claude Opus 5"');
    expect(source).toContain('providerName="Claude Fable 5"');
    expect(source).toContain("onRemove={index =>");
    expect(source).toContain("onAdd={() => setOpusApiKeys(keys => [...keys, \"\"])}");
    expect(source).toContain("onAdd={() => setFableApiKeys(keys => [...keys, \"\"])}");
    expect(source).toContain("removeSlots: opusRemovedSlots");
    expect(source).toContain("removeSlots: fableRemovedSlots");
  });
});
