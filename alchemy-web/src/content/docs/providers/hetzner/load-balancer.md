---
title: Load Balancer
description: Configure Layer 4 and Layer 7 load balancers for Hetzner Cloud.
---

Load Balancers distribute incoming traffic across multiple servers or targets.

## Quick Start

Create a basic HTTP load balancer:

```ts
import { LoadBalancer } from "alchemy/hetzner";

export const lb = await LoadBalancer("app-lb", {
  loadBalancerType: "lb11",
  location: "fsn1",
  services: [
    { protocol: "http", listen_port: 80, destination_port: 80 }
  ]
});
```

## Targets and Networks

Load Balancers can target servers directly and be integrated into private networks.

```ts
import { Server, Network, LoadBalancer } from "alchemy/hetzner";

const net = await Network("private", { ... });
const web = await Server("web", { networks: [net], ... });

await LoadBalancer("web-lb", {
  loadBalancerType: "lb11",
  networkZone: "eu-central",
  network: net,
  targets: [
    { type: "server", server: web, usePrivateIp: true }
  ],
  services: [
    { protocol: "http", listen_port: 80, destination_port: 80 }
  ]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `loadBalancerType` | `HetznerLoadBalancerType` | The SKU (e.g., `lb11`, `lb21`). |
| `algorithm` | `string` | `round_robin` or `least_connections`. |
| `services` | `Array` | Listener and backend configuration. |
| `targets` | `Array` | Backend servers or label selectors. |
| `network` | `string \| Network` | Private network to attach to. |
