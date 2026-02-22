---
title: DNS Zone
description: Manage Hetzner Cloud DNS Zones.
---

DNS Zones allow you to manage DNS records for your domains using Hetzner's infrastructure.

## Quick Start

Create a new DNS zone:

```ts
import { DNSZone } from "alchemy/hetzner";

export const zone = await DNSZone("main", {
  name: "example.com"
});
```

## Adoption

If you already have a zone configured in your Hetzner account, you can adopt it:

```ts
export const zone = await DNSZone("existing", {
  name: "run.actor",
  adopt: true
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The domain name (e.g., `example.com`). |
| `ttl` | `number` | Default TTL for the zone (default: 3600). |
| `delete` | `boolean` | Whether to delete the zone when removed from Alchemy (default: `true`). |

## Outputs

- `nameservers`: The authoritative nameservers assigned to the zone.
- `status`: Current status of the zone (e.g., `ok`).
