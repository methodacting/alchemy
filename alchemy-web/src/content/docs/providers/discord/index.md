# Discord

The Discord provider allows you to manage Discord servers (guilds), channels, roles, and webhooks as code.

[Official Discord Developer Portal](https://discord.com/developers/applications)

## Resources

- [Guild](./guild.md) - Create or adopt a Discord server.
- [Channel](./channel.md) - Manage text, voice, and category channels.
- [Role](./role.md) - Configure permissions and colors for roles.
- [Webhook](./webhook.md) - Create entry points for automated messages.

## Example Usage

```ts
import { Guild, Channel, Webhook, DiscordChannelType } from "alchemy/discord";

// Adopt an existing server
const guild = await Guild("main", {
  name: "Operations Server",
  adopt: true
});

// Create a category
const cat = await Channel("ops-cat", {
  guild,
  name: "Infrastructure",
  type: DiscordChannelType.GuildCategory
});

// Create an alerts channel
const alerts = await Channel("alerts", {
  guild,
  name: "alerts",
  parentId: cat
});

// Create a webhook for cloud notifications
const webhook = await Webhook("infra-bot", {
  channel: alerts,
  name: "Alchemy Alert"
});

console.log(`Webhook URL: ${webhook.url}`);
```
