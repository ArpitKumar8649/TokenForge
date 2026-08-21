import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("timed maintenance pause safeguards", () => {
  it("durably converts an elapsed countdown into global inference maintenance without changing model configuration", () => {
    const dbSource = source("server/db.ts");
    const activationStart = dbSource.indexOf("async function activateExpiredMaintenanceCountdown");
    const activationEnd = dbSource.indexOf("/** Returns the global inference admission state.", activationStart);
    const activationSource = dbSource.slice(activationStart, activationEnd);

    expect(dbSource).toContain('PLATFORM_MAINTENANCE_ERROR_MESSAGE = "Site entered in maintainence mode due to massive request."');
    expect(activationSource).toContain("countdown.endsAt > Date.now()");
    expect(activationSource).toContain('settingKey: PLATFORM_MAINTENANCE_SETTING_KEY, value: "enabled"');
    expect(activationSource).toContain('settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value: ""');
    expect(activationSource).not.toMatch(/modelAvailability|provider.*enabled|isModelAvailable/);
    expect(dbSource).toContain("await activateExpiredMaintenanceCountdown(db);");
  });

  it("provides a separate recovery operation that clears the timed pause without touching individual models", () => {
    const dbSource = source("server/db.ts");
    const recoveryStart = dbSource.indexOf("export async function resumePlatformAfterTimedMaintenance");
    const recoveryEnd = dbSource.indexOf("export type MaintenanceCountdown", recoveryStart);
    const recoverySource = dbSource.slice(recoveryStart, recoveryEnd);

    expect(recoverySource).toContain('settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value: ""');
    expect(recoverySource).toContain('settingKey: PLATFORM_MAINTENANCE_SETTING_KEY, value: "disabled"');
    expect(recoverySource).not.toMatch(/modelAvailability|provider.*enabled|isModelAvailable/);
  });

  it("uses the same maintenance response in OpenAI, Playground, and Anthropic request guards", () => {
    const openAiSource = source("server/openaiGateway.ts");
    const anthropicSource = source("server/anthropicGateway.ts");

    expect(openAiSource).toContain("PLATFORM_MAINTENANCE_ERROR_MESSAGE");
    expect(anthropicSource).toContain("PLATFORM_MAINTENANCE_ERROR_MESSAGE");
  });

  it("shows automatic pause behavior and one-click recovery only in the administrator operations panel", () => {
    const dashboardSource = source("client/src/pages/AdminDashboard.tsx");

    expect(dashboardSource).toContain("resumeTimedMaintenance");
    expect(dashboardSource).toContain("Automatic maintenance countdown");
    expect(dashboardSource).toContain("Resume platform calls");
    expect(dashboardSource).toContain("Individual model and provider settings are not changed.");
  });
});
