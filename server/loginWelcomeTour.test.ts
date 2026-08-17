import { describe, expect, it } from "vitest";
import { LOGIN_WELCOME_TOUR_ARTWORK, loginWelcomeSessionMarker, loginWelcomeTourArtworkClass, shouldShowLoginWelcomeTour } from "../client/src/components/LoginWelcomeTour";

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

  it("creates a fresh tour marker when the same account signs in again", () => {
    const firstLogin = loginWelcomeSessionMarker({ id: 42, lastSignedIn: "2026-08-17T10:00:00.000Z" });
    const laterLogin = loginWelcomeSessionMarker({ id: 42, lastSignedIn: "2026-08-17T11:00:00.000Z" });

    expect(laterLogin).not.toBe(firstLogin);
    expect(shouldShowLoginWelcomeTour(laterLogin, firstLogin)).toBe(true);
  });

  it("uses managed Claude Fable and Qwen artwork in the first two tour steps", () => {
    expect(LOGIN_WELCOME_TOUR_ARTWORK).toEqual({
      fable: "/manus-storage/claude-fable-5-welcome_9dff9b9b.jpg",
      qwen: "/manus-storage/qwen-3-8-max-welcome_2d739293.jpg",
    });
  });

  it("contains the Qwen artwork to preserve its headline while keeping Claude Fable full-bleed", () => {
    expect(loginWelcomeTourArtworkClass("qwen")).toContain("object-contain");
    expect(loginWelcomeTourArtworkClass("qwen")).toContain("bg-[#f7f5ff]");
    expect(loginWelcomeTourArtworkClass("fable")).toContain("object-cover");
  });
});
