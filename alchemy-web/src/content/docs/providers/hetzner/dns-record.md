---
title: DNS Record
description: Manage DNS Resource Record Sets (RRSet) in Hetzner Cloud.
---

DNS Records are managed as RRSets, allowing you to group multiple values for a single name and type.

## Quick Start

Create an A record pointing to an IP:

```ts
import { DNSZone, DNSRecord } from "alchemy/hetzner";

const zone = await DNSZone("main", { ... });

await DNSRecord("web-a", {
  zone,
  name: "www",
  type: "A",
  value: "1.2.3.4"
});
```

## Advanced Usage

Point a record to an Alchemy resource or define multiple values:

```ts
import { Server, DNSRecord } from "alchemy/hetzner";

const srv = await Server("app", { ... });

await DNSRecord("app-ip", {
  zone: "example.com",
  name: "api",
  type: "A",
  value: srv.publicIp, // Direct resource reference
  ttl: 60
});

await DNSRecord("mx", {
  zone: "example.com",
  name: "@",
  type: "MX",
  value: ["10 mail1.example.com.", "20 mail2.example.com."]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `zone` | `string \| DNSZone` | The parent DNS zone. |
| `name` | `string` | Relative name (e.g., `www`, `api`, or `@`). |
| `type` | `string` | DNS type (e.g., `A`, `CNAME`, `TXT`). |
| `value` | `string \| string[]` | The record value(s). |
| `ttl` | `number` | Custom TTL for this record set. |
