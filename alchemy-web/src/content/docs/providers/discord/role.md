---
title: Role
description: Configure permissions and colors for Discord roles.
---

Roles allow you to define permissions and organization for your server members.

## Quick Start

Create a "Developer" role with custom permissions:

```ts
import { Role } from "alchemy/discord";

export const devRole = await Role("dev", {
  guild: "123...",
  name: "Developer",
  color: 0x3498db,
  permissions: {
    ManageMessages: true,
    KickMembers: true,
    EmbedLinks: true
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `guild` | `string \| Guild` | The parent server. |
| `name` | `string` | Name of the role. |
| `color` | `number` | Hex color code as an integer (e.g., `0x3498db`). |
| `permissions` | `Object` | Map of permission names to booleans. |
| `hoist` | `boolean` | Display role separately in the sidebar. |
| `mentionable` | `boolean` | Whether anyone can mention this role. |
