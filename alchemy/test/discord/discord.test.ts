import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Guild } from "../../src/discord/guild.ts";
import { Channel } from "../../src/discord/channel.ts";
import { Webhook } from "../../src/discord/webhook.ts";
import { Role } from "../../src/discord/role.ts";
import { PermissionOverwrite } from "../../src/discord/permission-overwrite.ts";
import { ApplicationCommand } from "../../src/discord/application-command.ts";
import { AutoModerationRule } from "../../src/discord/auto-moderation-rule.ts";
import { Invite } from "../../src/discord/invite.ts";
import { Emoji } from "../../src/discord/emoji.ts";
import { GuildScheduledEvent } from "../../src/discord/guild-scheduled-event.ts";
import { GuildOnboarding } from "../../src/discord/guild-onboarding.ts";
import {
  DiscordChannelType,
  DiscordPermissionOverwriteType,
  DiscordApplicationCommandOptionType,
  DiscordAutoModerationEventType,
  DiscordAutoModerationTriggerType,
  DiscordAutoModerationActionType,
  DiscordScheduledEventEntityType,
} from "../../src/discord/types.ts";
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
      console.warn(
        "Skipping Discord tests: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set",
      );
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
        name: "methodactor",
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

      // Create Voice Channel for events
      const voiceChannel = await Channel("voice-main", {
        guild: guildId,
        name: "Community Voice",
        type: DiscordChannelType.GuildVoice,
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
        },
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe(`${baseName}-Dev`);

      // 5. Create Webhook
      webhook = await Webhook("infra-bot", {
        channel: channel,
        name: "Infra Bot",
      });

      expect(webhook.url).toBeDefined();
      expect(webhook.channelId).toBe(channel.id);

      // 6. Private Channel Setup
      const privateChan = await Channel("secret", {
        guild: guildId,
        name: "private-chat",
      });

      // Deny @everyone (Guild ID is @everyone role ID)
      await PermissionOverwrite("hide-from-all", {
        channel: privateChan,
        target: guildId,
        targetType: DiscordPermissionOverwriteType.Role,
        deny: {
          ViewChannel: true,
        },
      });

      // Allow the dev role
      await PermissionOverwrite("show-to-dev", {
        channel: privateChan,
        target: role,
        allow: {
          ViewChannel: true,
        },
      });

      // 7. Guild Command
      const pingCmd = await ApplicationCommand("ping", {
        guild: guildId,
        name: "ping",
        description: "Alchemy health check",
        options: [
          {
            name: "silent",
            description: "Whether to reply silently",
            type: DiscordApplicationCommandOptionType.Boolean,
            required: false,
          },
        ],
      });

      expect(pingCmd.id).toBeDefined();
      expect(pingCmd.name).toBe("ping");

      // 8. Auto Moderation Rule
      const automod = await AutoModerationRule("bad-words", {
        guild: guildId,
        name: `${baseName}-Filter`,
        eventType: DiscordAutoModerationEventType.MessageSend,
        triggerType: DiscordAutoModerationTriggerType.Keyword,
        triggerMetadata: {
          keyword_filter: ["alchemy-test-blocked"],
        },
        actions: [{ type: DiscordAutoModerationActionType.BlockMessage }],
        enabled: true,
      });

      expect(automod.id).toBeDefined();
      expect(automod.name).toBe(`${baseName}-Filter`);

      // 9. Invite
      const invite = await Invite("main-link", {
        channel: channel,
        maxAge: 3600,
        maxUses: 1,
      });

      expect(invite.code).toBeDefined();
      expect(invite.url).toContain("discord.gg/");

      // 10. Emoji
      const emoji = await Emoji("test-emoji", {
        guild: guildId,
        name: `alchemy_${Date.now()}`,
        image:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      });

      expect(emoji.id).toBeDefined();
      expect(emoji.name).toContain("alchemy_");

      // 11. Guild Scheduled Event
      const event = await GuildScheduledEvent("voice-event", {
        guild: guildId,
        name: `${baseName}-AMA`,
        description: "Ask Me Anything about Alchemy",
        startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        entityType: DiscordScheduledEventEntityType.Voice,
        channel: voiceChannel,
      });

      expect(event.id).toBeDefined();
      expect(event.name).toBe(`${baseName}-AMA`);
      expect(event.channelId).toBe(voiceChannel.id);

      // 12. Guild Onboarding
      // Note: Onboarding requires the guild to be a Community.
      // Our test guild might not be a community, so this might fail if we don't enable it.
      // But 'COMMUNITY' feature is usually immutable via API for safety.
      // We will try to set it up, but expect it might fail on non-community servers.
      // However, for the sake of provider verification, we assume the user has a Community server or the test environment supports it.

      // Check if guild has COMMUNITY feature
      const guildData = await api.get<any>(`/guilds/${guildId}`);
      if (guildData.features.includes("COMMUNITY")) {
        const onboarding = await GuildOnboarding("setup-onboarding", {
          guild: guildId,
          enabled: true,
          defaultChannels: [channel],
          prompts: [
            {
              title: "Pick your role",
              options: [
                {
                  title: "Developer",
                  description: "I write code",
                  roles: [role],
                  channels: [privateChan],
                },
              ],
            },
          ],
        });

        expect(onboarding.id).toBe(guildId);
        expect(onboarding.enabled).toBe(true);
      } else {
        console.warn("Skipping Onboarding test: Guild is not a Community");
      }
    } finally {
      await destroy(scope);
    }
  }, 180000);
});
