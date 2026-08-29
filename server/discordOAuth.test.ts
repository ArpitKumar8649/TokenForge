import { describe, expect, it, vi } from "vitest";
import { buildDiscordAuthorizationUrl, isDiscordGuildMember } from "./discordOAuth";

describe("Discord OAuth membership verification", () => {
  it("builds an identify-only authorization request bound to the caller state", () => {
    const url = new URL(buildDiscordAuthorizationUrl({
      clientId: "discord-client-id",
      redirectUri: "https://tokenforge.work.gd/api/auth/discord/callback",
      state: "csrf-bound-state",
    }));

    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("discord-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("https://tokenforge.work.gd/api/auth/discord/callback");
    expect(url.searchParams.get("scope")).toBe("identify");
    expect(url.searchParams.get("state")).toBe("csrf-bound-state");
  });

  it("treats a Discord guild-member response as verified and never sends a browser credential", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 200, ok: true });

    await expect(isDiscordGuildMember({ guildId: "guild-123", discordUserId: "user-456", botToken: "server-only-token", fetchImpl: fetchImpl as typeof fetch })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://discord.com/api/v10/guilds/guild-123/members/user-456",
      { headers: { Authorization: "Bot server-only-token" } },
    );
  });

  it("treats Discord's not-found response as a non-member without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 404, ok: false });
    await expect(isDiscordGuildMember({ guildId: "guild-123", discordUserId: "user-456", botToken: "server-only-token", fetchImpl: fetchImpl as typeof fetch })).resolves.toBe(false);
  });

  it("fails closed when the Discord membership API returns another error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ status: 503, ok: false });
    await expect(isDiscordGuildMember({ guildId: "guild-123", discordUserId: "user-456", botToken: "server-only-token", fetchImpl: fetchImpl as typeof fetch })).rejects.toThrow("membership lookup failed");
  });
});
