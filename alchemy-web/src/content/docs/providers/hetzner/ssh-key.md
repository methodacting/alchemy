---
title: SSH Key
description: Manage SSH public keys for Hetzner Cloud Servers.
---

SSH Keys allow you to securely access your Hetzner Cloud Servers without a password.

## Quick Start

Register a public key:

```ts
import { SSHKey } from "alchemy/hetzner";

export const myKey = await SSHKey("personal", {
  publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFp2oxZ66idmUnY+SIsZIDpS0TdkZqS6Id6SIsZIDpS0"
});
```

## Integration

Inject the key into a server during creation:

```ts
import { Server, SSHKey } from "alchemy/hetzner";

const key = await SSHKey("admin", { ... });

await Server("web", {
  // ...
  sshKeys: [key]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `publicKey` | `string` | The OpenSSH public key string. |
| `labels` | `Record<string, string>` | Key-value pairs for organization. |
| `adopt` | `boolean` | Whether to adopt an existing key by name (default: `false`). |
