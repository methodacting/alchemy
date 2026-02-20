import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Guild } from "../../src/discord/guild.ts";
import { Channel } from "../../src/discord/channel.ts";
import { Webhook } from "../../src/discord/webhook.ts";
import { Role } from "../../src/discord/role.ts";
import { DiscordChannelType } from "../../src/discord/types.ts";
import { createDiscordApi } from "../../src/discord/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createDiscordApi();

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Discord", () => {
  test("create community infrastructure in existing guild", async (scope) => {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
      console.warn("Skipping Discord tests: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set");
      return;
    }

    const guildId = process.env.DISCORD_GUILD_ID;
    const baseName = `${BRANCH_PREFIX}-test`;
    
    let category: any;
    let channel: any;
    let webhook: any;
    let role: any;

    try {
      // 1. Adopt Guild
      const guild = await Guild("main", {
        name: "Test Guild",
        adopt: true,
      });
      // Note: In real scenarios, users might pass the raw ID string
      // But we test the resource adoption path.

      // 2. Create Category
      category = await Channel("ops-cat", {
        guild: guildId,
        name: `${baseName}-Ops`,
        type: DiscordChannelType.GuildCategory,
      });

      expect(category.id).toBeDefined();
      expect(category.name).toBe(`${baseName}-Ops`);

      // 3. Create Channel in Category
      channel = await Channel("alerts", {
        guild: guildId,
        name: "alerts",
        parentId: category,
      });

      expect(channel.parentId).toBe(category.id);

      // 4. Create Role
      role = await Role("dev", {
        guild: guildId,
        name: `${baseName}-Dev`,
        color: 0x3498db,
        permissions: {
          ManageMessages: true,
        }
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe(`${baseName}-Dev`);

      // 5. Create Webhook
      webhook = await Webhook("infra-bot", {
        channel: channel,
        name: "Infra Bot"
      });

      expect(webhook.url).toBeDefined();
      expect(webhook.channelId).toBe(channel.id);

    } finally {
      await destroy(scope);
    }
  }, 180000);
});
