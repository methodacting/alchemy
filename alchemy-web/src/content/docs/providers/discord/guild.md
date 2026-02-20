---
title: Guild
description: Create or adopt a Discord server (guild) using Alchemy.
---

A Guild is the top-level container in Discord, commonly referred to as a "Server".

## Quick Start

Adopt an existing server by name:

```ts
import { Guild } from "alchemy/discord";

export const guild = await Guild("main", {
  name: "My Community",
  adopt: true
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The name of the server. |
| `verificationLevel` | `number` | The verification level required for members. |
| `adopt` | `boolean` | Whether to adopt an existing guild by name (default: `false`). |

## Bot Permissions

To manage a guild, your Discord Bot must be a member of the server and have the **Manage Guild** permission. If you are using the bot to create a new guild, it will automatically become the owner.
