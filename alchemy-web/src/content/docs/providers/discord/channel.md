---
title: Channel
description: Manage Discord text, voice, and category channels.
---

Channels are the individual chat and voice rooms within a Discord server.

## Quick Start

Create a text channel inside a category:

```ts
import { Channel, DiscordChannelType } from "alchemy/discord";

const cat = await Channel("ops", {
  guild: "123...",
  name: "Operations",
  type: DiscordChannelType.GuildCategory
});

await Channel("alerts", {
  guild: "123...",
  name: "cloud-alerts",
  parentId: cat
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `guild` | `string \| Guild` | The parent server. |
| `name` | `string` | Name of the channel. |
| `type` | `DiscordChannelType` | Type of channel (default: `GuildText`). |
| `parentId` | `string \| Channel` | The ID or resource of the parent category. |
| `topic` | `string` | Channel description or topic. |
| `nsfw` | `boolean` | Whether the channel is age-restricted. |
