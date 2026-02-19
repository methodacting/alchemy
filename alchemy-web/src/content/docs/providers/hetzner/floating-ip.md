---
title: Floating IP
description: Manage and assign floating IPv4 and IPv6 addresses.
---

Floating IPs are static IP addresses that can be dynamically reassigned to any server in the same location.

## Quick Start

Create a floating IPv4 address:

```ts
import { FloatingIP } from "alchemy/hetzner";

export const ip = await FloatingIP("web-ip", {
  type: "ipv4",
  homeLocation: "hel1"
});
```

## Assignment

You can assign a floating IP to a server by ID or by resource object.

```ts
import { Server, FloatingIP } from "alchemy/hetzner";

const web = await Server("web", { ... });

await FloatingIP("app-ip", {
  type: "ipv4",
  homeLocation: "hel1",
  server: web // Automatically assigns to this server
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"ipv4" \| "ipv6"` | The type of address to allocate. |
| `homeLocation` | `HetznerLocation` | The location where the IP is rooted. |
| `server` | `string \| Server` | The server to assign the IP to. |
| `delete` | `boolean` | Whether to release the IP when removed from Alchemy (default: `true`). |
