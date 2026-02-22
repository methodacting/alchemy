---
title: Network
description: Create and manage private networks for Hetzner Cloud Servers.
---

Networks provide isolated, private communication between your servers.

## Quick Start

Create a private network with a subnet:

```ts
import { Network } from "alchemy/hetzner";

export const privateNet = await Network("main", {
  ipRange: "10.0.0.0/8",
  subnets: [
    { type: "cloud", network_zone: "eu-central", ip_range: "10.0.1.0/24" }
  ]
});
```

## Integration

Attach a server to the network by referencing it in the `networks` property:

```ts
import { Server, Network } from "alchemy/hetzner";

const net = await Network("private", { ... });

await Server("app", {
  // ...
  networks: [net]
});
```

### Static Routes

You can define custom routing within your network:

```ts
await Network("main", {
  ipRange: "10.0.0.0/8",
  routes: [
    { destination: "10.100.0.0/24", gateway: "10.0.1.1" }
  ]
});
```
