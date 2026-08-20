import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = (relativePath: string) => readFileSync(path.join(projectRoot, relativePath), "utf8");

describe("maintenance countdown presentation coverage", () => {
  it("mounts the database-backed countdown below the announcement in every page shell", () => {
    const publicNav = source("client/src/components/PublicNav.tsx");
    const dashboardLayout = source("client/src/components/DashboardLayout.tsx");
    const localAuth = source("client/src/pages/LocalAuth.tsx");
    const discordVerify = source("client/src/pages/DiscordVerify.tsx");
    const notFound = source("client/src/pages/NotFound.tsx");

    expect(publicNav).toContain("<AnnouncementBanner />\n    <MaintenanceCountdownBanner />");
    expect(dashboardLayout).toContain("<AnnouncementBanner />\n        <MaintenanceCountdownBanner />");
    expect(localAuth).toContain("<AnnouncementBanner /><MaintenanceCountdownBanner /><main");
    expect(discordVerify).toContain("return <><AnnouncementBanner /><MaintenanceCountdownBanner /></>;");
    expect(notFound).toContain("<><AnnouncementBanner /><MaintenanceCountdownBanner /><div");
  });
});
