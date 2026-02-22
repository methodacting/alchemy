---
title: Volume
description: Manage block storage volumes for Hetzner Cloud Servers.
---

Volumes provide persistent block storage that can be attached to any Hetzner Cloud Server in the same location.

## Quick Start

Create a standalone volume:

```ts
import { Volume } from "alchemy/hetzner";

export const data = await Volume("data", {
  size: 20, // GB
  location: "nbg1",
  format: "ext4"
});
```

## Attachment

You can attach a volume directly to a server during creation or later by updating the `server` property.

```ts
import { Server, Volume } from "alchemy/hetzner";

const srv = await Server("app", { ... });

const disk = await Volume("app-disk", {
  size: 50,
  server: srv.id,
  automount: true
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `size` | `number` | Size in GB (minimum 10). |
| `location` | `HetznerLocation` | Physical location. Must match the server. |
| `server` | `string` | ID of the server to attach to. |
| `format` | `HetznerVolumeFormat` | Automatically format as `ext4` or `xfs` on creation. |
| `delete` | `boolean` | Whether to delete the volume when removed from Alchemy (default: `true`). |

:::caution
Hetzner only supports **increasing** the size of a volume. Reducing the `size` property will result in an error.
:::
