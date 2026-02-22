# Discord Provider

The Discord provider allows you to manage Discord infrastructure as code using Alchemy.

## Resources

- [`Guild`](./guild.ts) - Adopt or manage Discord servers.
- [`Channel`](./channel.ts) - Manage categories, text, and voice channels.
- [`Role`](./role.ts) - Manage server roles and global permissions.
- [`Webhook`](./webhook.ts) - Manage incoming webhooks for channels.
- [`PermissionOverwrite`](./permission-overwrite.ts) - Manage granular channel permissions for roles or members.
- [`ApplicationCommand`](./application-command.ts) - Manage global or guild-specific slash commands.
- [`AutoModerationRule`](./auto-moderation-rule.ts) - Manage server safety rules and keyword filters.
- [`Invite`](./invite.ts) - Manage channel invite links.
- [`Emoji`](./emoji.ts) - Manage custom server emojis.
- [`Sticker`](./sticker.ts) - Manage custom server stickers.
- [`SoundboardSound`](./soundboard-sound.ts) - Manage custom soundboard sounds.
- [`GuildScheduledEvent`](./guild-scheduled-event.ts) - Manage scheduled events like AMAs or Town Halls.
- [`GuildOnboarding`](./guild-onboarding.ts) - Manage the "New Member Experience" flow.

## Setup

You will need a Discord Bot Token and the Target Guild ID.

```bash
export DISCORD_BOT_TOKEN="your-bot-token"
export DISCORD_GUILD_ID="your-guild-id"
```

The bot must have the `Administrator` permission (or specific permissions like `Manage Channels`, `Manage Roles`, etc.) in the target guild.

## Example Usage

```ts
import { 
  Guild, 
  Channel, 
  Role, 
  PermissionOverwrite, 
  ApplicationCommand,
  DiscordChannelType,
  DiscordPermissionOverwriteType
} from "@alchemy/discord";

// Adopt the existing guild
const guild = await Guild("main", {
  name: "My Community",
  adopt: true
});

// Create a staff role
const staffRole = await Role("staff", {
  guild: guild.id,
  name: "Staff",
  color: 0xe74c3c,
  mentionable: true
});

// Create a private staff channel
const staffChannel = await Channel("staff-chat", {
  guild: guild.id,
  name: "staff-only",
  topic: "Private discussion for staff members"
});

// Lock it down
await PermissionOverwrite("hide-from-everyone", {
  channel: staffChannel,
  target: guild.id, // @everyone role
  targetType: DiscordPermissionOverwriteType.Role,
  deny: { ViewChannel: true }
});

await PermissionOverwrite("allow-staff", {
  channel: staffChannel,
  target: staffRole,
  allow: { ViewChannel: true, SendMessages: true }
});

// Register a slash command
await ApplicationCommand("ping", {
  guild: guild.id,
  name: "ping",
  description: "Check if the bot is responsive"
});

// Set up a safety rule
await AutoModerationRule("no-bad-words", {
  guild: guild.id,
  name: "Filter Bad Words",
  eventType: DiscordAutoModerationEventType.MessageSend,
  triggerType: DiscordAutoModerationTriggerType.Keyword,
  triggerMetadata: {
    keyword_filter: ["badword1", "badword2"]
  },
  actions: [
    { type: DiscordAutoModerationActionType.BlockMessage }
  ],
  enabled: true
});

// Create a permanent invite link
const invite = await Invite("main-link", {
  channel: staffChannel,
  maxAge: 0,
  maxUses: 0
});

// Add a custom emoji
await Emoji("rocket", {
  guild: guild.id,
  name: "alchemy_rocket",
  image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
});

// Schedule a Town Hall
await GuildScheduledEvent("town-hall", {
  guild: guild.id,
  name: "Weekly Town Hall",
  description: "Community updates and Q&A",
  startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  entityType: DiscordScheduledEventEntityType.Voice,
  channel: voiceChannel
});

// Configure Onboarding
await GuildOnboarding("main-onboarding", {
  guild: guild.id,
  enabled: true,
  defaultChannels: [rulesChannel, generalChannel],
  prompts: [
    {
      title: "What are you interested in?",
      options: [
        {
          title: "Development",
          description: "Coding discussions",
          channels: [devChannel],
          roles: [devRole]
        },
        {
          title: "Design",
          description: "UI/UX discussions",
          channels: [designChannel]
        }
      ]
    }
  ]
});

console.log(`Join here: ${invite.url}`);
```
