---
title: DNS Record
description: Manage individual DNS records in Porkbun.
---

The `DNSRecord` resource manages a single DNS record for a domain.

## Quick Start

Create an A record:

```ts
import { DNSRecord } from "alchemy/porkbun";

await DNSRecord("web-ip", {
  domain: "example.com",
  name: "www",
  type: "A",
  content: "1.2.3.4"
});
```

## Advanced Usage

Use a `Domain` resource object and set custom TTL:

```ts
import { Domain, DNSRecord } from "alchemy/porkbun";

const domain = await Domain("main", { ... });

await DNSRecord("api", {
  domain,
  name: "api",
  type: "CNAME",
  content: "lb.example.com",
  ttl: 600
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `domain` | `string \| Domain` | The domain to add the record to. |
| `name` | `string` | The subdomain (e.g., `www`, `api`). Use `@` or leave blank for root. |
| `type` | `string` | DNS type (e.g., `A`, `CNAME`, `MX`, `TXT`). |
| `content` | `string` | The value for the record. |
| `ttl` | `number` | Time to live in seconds (minimum 600). |
| `prio` | `number` | Priority for supported record types (e.g., MX). |
