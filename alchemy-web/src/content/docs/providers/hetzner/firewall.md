---
title: Firewall
description: Configure stateful firewall rules for Hetzner Cloud resources.
---

Firewalls allow you to restrict incoming and outgoing traffic for your servers and other resources.

## Quick Start

Create a firewall that allows HTTP and HTTPS traffic:

```ts
import { Firewall } from "alchemy/hetzner";

export const webFw = await Firewall("web-sec", {
  rules: [
    { direction: "in", protocol: "tcp", port: "80", source_ips: ["0.0.0.0/0", "::/0"] },
    { direction: "in", protocol: "tcp", port: "443", source_ips: ["0.0.0.0/0", "::/0"] }
  ]
});
```

## Applying to Resources

A firewall can be applied to servers by ID, by resource object, or via label selectors.

```ts
import { Server, Firewall } from "alchemy/hetzner";

const srv = await Server("app", { ... });

await Firewall("app-fw", {
  rules: [...],
  applyTo: [srv] // Automatically attaches to this server
});
```

### Rule Structure

| Field | Description |
|-------|-------------|
| `direction` | `in` or `out`. |
| `protocol` | `tcp`, `udp`, `icmp`, `esp`, or `gre`. |
| `port` | Port or range (e.g., `80`, `1000-2000`). |
| `source_ips` | Array of CIDRs for incoming rules. |
| `destination_ips` | Array of CIDRs for outgoing rules. |
