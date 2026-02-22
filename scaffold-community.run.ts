import { alchemy } from "./alchemy/src/alchemy.ts";
import { Guild } from "./alchemy/src/discord/guild.ts";
import { Channel } from "./alchemy/src/discord/channel.ts";
import { Role } from "./alchemy/src/discord/role.ts";
import { PermissionOverwrite } from "./alchemy/src/discord/permission-overwrite.ts";
import { ApplicationCommand } from "./alchemy/src/discord/application-command.ts";
import { GuildOnboarding } from "./alchemy/src/discord/guild-onboarding.ts";
import {
  DiscordChannelType,
  DiscordPermissionOverwriteType,
  DiscordApplicationCommandOptionType,
  DiscordOnboardingPromptType,
} from "./alchemy/src/discord/types.ts";

// Initialize the Alchemy app
const app = await alchemy("tech-community");

const guildId = process.env.DISCORD_GUILD_ID;
if (!guildId) {
  throw new Error("DISCORD_GUILD_ID is required");
}

// 1. Adopt the Guild
const guild = await Guild("main", {
  name: "methodactor", // Using your guild name
  adopt: true,
});

// 2. Create Roles
const adminRole = await Role("admin-role", {
  guild: guild.id,
  name: "🛡️ Admin",
  color: 0xe74c3c, // Red
  hoist: true,
  permissions: {
    Administrator: true,
  },
});

const modRole = await Role("mod-role", {
  guild: guild.id,
  name: "🔧 Moderator",
  color: 0x3498db, // Blue
  hoist: true,
  mentionable: true,
  permissions: {
    KickMembers: true,
    BanMembers: true,
    ManageMessages: true,
    MuteMembers: true,
  },
});

const devRole = await Role("dev-role", {
  guild: guild.id,
  name: "💻 Developer",
  color: 0x2ecc71, // Green
  hoist: true,
});

// 3. Welcome Category & Channels
const welcomeCat = await Channel("welcome-cat", {
  guild: guild.id,
  name: "👋 Welcome",
  type: DiscordChannelType.GuildCategory,
});

const rulesChannel = await Channel("rules-channel", {
  guild: guild.id,
  name: "rules",
  topic: "Please read and follow the rules.",
  parentId: welcomeCat,
});

// Lock down Rules Channel: Deny SendMessages for @everyone (Guild ID)
await PermissionOverwrite("rules-readonly", {
  channel: rulesChannel,
  target: guild.id, // @everyone
  targetType: DiscordPermissionOverwriteType.Role,
  deny: {
    SendMessages: true,
  },
});

const announcementsChannel = await Channel("announcements-channel", {
  guild: guild.id,
  name: "announcements",
  topic: "Community updates.",
  parentId: welcomeCat,
});

// Lock down Announcements: Deny @everyone, Allow Mods/Admins
await PermissionOverwrite("announcements-readonly", {
  channel: announcementsChannel,
  target: guild.id,
  targetType: DiscordPermissionOverwriteType.Role,
  deny: {
    SendMessages: true,
  },
});

await PermissionOverwrite("announcements-write-mod", {
  channel: announcementsChannel,
  target: modRole,
  targetType: DiscordPermissionOverwriteType.Role,
  allow: {
    SendMessages: true,
    MentionEveryone: true,
  },
});

// 4. Community Category & Channels
const communityCat = await Channel("community-cat", {
  guild: guild.id,
  name: "💬 Community",
  type: DiscordChannelType.GuildCategory,
});

const generalChannel = await Channel("general-channel", {
  guild: guild.id,
  name: "general",
  topic: "Talk about anything.",
  parentId: communityCat,
});

const introChannel = await Channel("intro-channel", {
  guild: guild.id,
  name: "introductions",
  parentId: communityCat,
});

const loungeVoice = await Channel("lounge-voice", {
  guild: guild.id,
  name: "Lounge",
  type: DiscordChannelType.GuildVoice,
  parentId: communityCat,
});

// 5. Staff Area (Private)
const staffCat = await Channel("staff-cat", {
  guild: guild.id,
  name: "🔒 Staff Area",
  type: DiscordChannelType.GuildCategory,
});

// Hide Staff Category from @everyone
await PermissionOverwrite("staff-cat-hide", {
  channel: staffCat,
  target: guild.id,
  targetType: DiscordPermissionOverwriteType.Role,
  deny: {
    ViewChannel: true,
  },
});

// Allow Mods & Admins
await PermissionOverwrite("staff-cat-allow-mod", {
  channel: staffCat,
  target: modRole,
  targetType: DiscordPermissionOverwriteType.Role,
  allow: {
    ViewChannel: true,
  },
});

await PermissionOverwrite("staff-cat-allow-admin", {
  channel: staffCat,
  target: adminRole,
  targetType: DiscordPermissionOverwriteType.Role,
  allow: {
    ViewChannel: true,
  },
});

const modChat = await Channel("mod-chat", {
  guild: guild.id,
  name: "mod-chat",
  parentId: staffCat, // Inherits permissions from category
});

// 6. Application Command
await ApplicationCommand("ping-cmd", {
  guild: guild.id,
  name: "ping",
  description: "Check bot latency",
});

// 7. Onboarding (Requires Server to be a "Community")
await GuildOnboarding("onboarding-flow", {
  guild: guild.id,
  enabled: true,
  defaultChannels: [
    rulesChannel,
    announcementsChannel,
    generalChannel,
    introChannel,
    loungeVoice,
  ],
  prompts: [
    {
      title: "What are you here for?",
      type: DiscordOnboardingPromptType.MultipleChoice,
      singleSelect: true,
      options: [
        {
          title: "Development",
          description: "I write code and want to contribute.",
          emoji: { name: "💻" },
          roles: [devRole],
          channels: [generalChannel, introChannel],
        },
        {
          title: "Community",
          description: "I'm just here to hang out.",
          emoji: { name: "👋" },
          channels: [generalChannel, introChannel],
        },
        {
          title: "Moderation",
          description: "I'm interested in helping manage the community.",
          emoji: { name: "🛡️" },
          roles: [modRole], // Note: Usually mods are hand-picked, but for demo:
          channels: [modChat],
        },
      ],
    },
  ],
});

await app.finalize();
