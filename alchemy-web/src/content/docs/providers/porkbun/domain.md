---
title: Domain
description: Register and manage Porkbun domains using Alchemy.
---

The `Domain` resource allows you to register new domains or manage settings for existing ones.

## Quick Start

Register a new domain:

```ts
import { Domain } from "alchemy/porkbun";

export const site = await Domain("site", {
  domain: "my-awesome-new-app.com",
  agreeToTerms: true,
  maxCost: 15, // Max $15 USD
  autoRenew: true
});
```

## Adoption

Manage a domain you already own by setting `adopt: true`:

```ts
import { Domain } from "alchemy/porkbun";

export const domain = await Domain("existing", {
  domain: "run.actor",
  adopt: true,
  nameservers: ["ns1.hetzner.com", "ns2.hetzner.com"]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `domain` | `string` | The full domain name (e.g., `example.com`). |
| `nameservers` | `string[]` | List of authoritative nameservers. |
| `autoRenew` | `boolean` | Enable or disable auto-renewal (default: `true`). |
| `whoisPrivacy` | `boolean` | Enable or disable WHOIS privacy (default: `true`). |
| `agreeToTerms` | `boolean` | Required to be `true` for new registrations. |
| `maxCost` | `number` | Safety limit for registration cost in USD. |
| `adopt` | `boolean` | Whether to adopt an existing domain (default: `false`). |

## Deletion

Deleting a `Domain` resource in Alchemy is a **noop**. It will remove the domain from Alchemy's state, but will **not** cancel or delete the domain registration at Porkbun.
