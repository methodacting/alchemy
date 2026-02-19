---
title: Domain
description: Register and manage Dynadot domains using Alchemy.
---

The `Domain` resource allows you to register new domains or manage settings for existing ones.

## Quick Start

Register a new domain in the sandbox:

```ts
import { Domain } from "alchemy/dynadot";

export const site = await Domain("site", {
  domainName: "my-app-sandbox.com",
  duration: 1,
  sandbox: true
});
```

## Adoption

Manage a domain you already own by setting `adopt: true`:

```ts
import { Domain } from "alchemy/dynadot";

export const domain = await Domain("existing", {
  domainName: "run.actor",
  adopt: true,
  nameservers: ["ns1.hetzner.com", "ns2.hetzner.com"]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `domainName` | `string` | The full domain name (e.g., `example.com`). |
| `duration` | `number` | Registration period in years (default: 1). |
| `nameservers` | `string[]` | List of authoritative nameservers. |
| `autoRenew` | `boolean` | Enable or disable auto-renewal (default: `true`). |
| `whoisPrivacy` | `boolean` | Enable or disable WHOIS privacy (default: `true`). |
| `sandbox` | `boolean` | Whether to use the Dynadot Sandbox environment. |
| `adopt` | `boolean` | Whether to adopt an existing domain (default: `false`). |

## Deletion

Deleting a `Domain` resource in Alchemy is a **noop**. It will remove the domain from Alchemy's state, but will **not** cancel or delete the domain registration at Dynadot.
