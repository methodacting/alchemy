---
title: Certificate
description: Manage managed (Let's Encrypt) and uploaded SSL/TLS certificates.
---

Certificates allow you to secure your services with SSL/TLS, and can be easily attached to Load Balancers.

## Quick Start

Create a managed Let's Encrypt certificate:

```ts
import { Certificate } from "alchemy/hetzner";

export const cert = await Certificate("site-ssl", {
  type: "managed",
  domainNames: ["example.com", "www.example.com"]
});
```

## Uploaded Certificates

You can also upload existing PEM-encoded certificates and private keys.

```ts
import { Certificate } from "alchemy/hetzner";

await Certificate("manual-ssl", {
  type: "uploaded",
  certificate: "-----BEGIN CERTIFICATE-----...",
  privateKey: alchemy.secret("-----BEGIN PRIVATE KEY-----...")
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"managed" \| "uploaded"` | The source of the certificate. |
| `domainNames` | `string[]` | Required for `managed`. |
| `certificate` | `string` | Required for `uploaded` (PEM). |
| `privateKey` | `Secret` | Required for `uploaded` (PEM). |

## Integration

Attach a certificate to a Load Balancer service:

```ts
import { LoadBalancer, Certificate } from "alchemy/hetzner";

const cert = await Certificate("ssl", { ... });

await LoadBalancer("lb", {
  // ...
  services: [{
    protocol: "https",
    listen_port: 443,
    http: { certificates: [cert] }
  }]
});
```
