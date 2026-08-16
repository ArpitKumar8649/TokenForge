import { describe, expect, it } from "vitest";

const discordConfig = {
  clientId: process.env.DISCORD_CLIENT_ID?.trim() ?? "",
  clientSecret: process.env.DISCORD_CLIENT_SECRET?.trim() ?? "",
  botToken: process.env.DISCORD_BOT_TOKEN?.trim() ?? "",
  guildId: process.env.DISCORD_GUILD_ID?.trim() ?? "",
};

describe("Discord OAuth configuration", () => {
  it(
    "can read the configured guild with the configured server-only bot credential",
    async () => {
      expect(discordConfig.clientId).not.toBe("");
      expect(discordConfig.clientSecret).not.toBe("");
      expect(discordConfig.botToken).not.toBe("");
      expect(discordConfig.guildId).toMatch(/^\d{16,22}$/);

      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(discordConfig.guildId)}`,
        {
          headers: {
            Authorization: `Bot ${discordConfig.botToken}`,
          },
          signal: AbortSignal.timeout(15_000),
        },
      );

      expect(response.ok, `Discord guild verification returned HTTP ${response.status}`).toBe(true);

      const guild = (await response.json()) as { id?: string };
      expect(guild.id).toBe(discordConfig.guildId);
    },
    20_000,
  );
});
