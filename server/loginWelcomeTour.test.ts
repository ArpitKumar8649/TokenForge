import { describe, expect, it } from "vitest";
import { loginWelcomeSessionMarker, shouldShowLoginWelcomeTour } from "../client/src/components/LoginWelcomeTour";

describe("LoginWelcomeTour session behavior", () => {
  it("opens once for a newly authenticated login session and not again after completion", () => {
    const marker = loginWelcomeSessionMarker({
      id: 42,
      createdAt: "2026-08-17T00:00:00.000Z",
      lastSignedIn: "2026-08-17T10:00:00.000Z",
    });

    expect(shouldShowLoginWelcomeTour(marker, null)).toBe(true);
    expect(shouldShowLoginWelcomeTour(marker, marker)).toBe(false);
  });

  it("stays completed through ordinary reloads that preserve the same successful sign-in timestamp", () => {
    const completedMarker = loginWelcomeSessionMarker({
      id: 42,
      lastSignedIn: "2026-08-17T10:00:00.000Z",
    });
    const markerAfterReload = loginWelcomeSessionMarker({
      id: 42,
      lastSignedIn: "2026-08-17T10:00:00.000Z",
    });

    expect(markerAfterReload).toBe(completedMarker);
    expect(shouldShowLoginWelcomeTour(markerAfterReload, completedMarker)).toBe(false);
  });

  it("creates a fresh tour marker when the same account signs in again", () => {
    const firstLogin = loginWelcomeSessionMarker({ id: 42, lastSignedIn: "2026-08-17T10:00:00.000Z" });
    const laterLogin = loginWelcomeSessionMarker({ id: 42, lastSignedIn: "2026-08-17T11:00:00.000Z" });

    expect(laterLogin).not.toBe(firstLogin);
    expect(shouldShowLoginWelcomeTour(laterLogin, firstLogin)).toBe(true);
  });
});
