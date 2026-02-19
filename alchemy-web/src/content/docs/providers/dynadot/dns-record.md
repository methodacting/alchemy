---
title: DNS Record
description: Manage individual DNS records in Dynadot.
---

The `DNSRecord` resource manages a single DNS record for a domain.

## Quick Start

Create an A record:

```ts
import { DNSRecord } from "alchemy/dynadot";

await DNSRecord("web-ip", {
  domain: "example.com",
  host: "www",
  type: "A",
  value: "1.2.3.4"
});
```

## Integration

Since Dynadot's API updates all records at once, Alchemy automatically fetches, merges, and synchronizes your records.

```ts
import { Domain, DNSRecord } from "alchemy/dynadot";

const domain = await Domain("main", { ... });

await DNSRecord("api", {
  domain,
  host: "api",
  type: "CNAME",
  value: "lb.example.com",
  ttl: 3600
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `domain` | `string \| Domain` | The domain to add the record to. |
| `host` | `string` | The subdomain (e.g., `www`, `api`). Use `@` or leave blank for root. |
| `type` | `string` | DNS type (e.g., `A`, `CNAME`, `MX`, `TXT`). |
| `value` | `string` | The record value. |
| `ttl` | `number` | Time to live in seconds. |
| `sandbox` | `boolean` | Whether to use the Dynadot Sandbox environment. |
