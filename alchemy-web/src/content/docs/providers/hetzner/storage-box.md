---
title: Storage Box
description: Manage persistent file storage using Hetzner Storage Boxes.
---

Storage Boxes provide redundant network storage accessible via FTP, SSH, Samba, and WebDAV.

## Quick Start

Create a 1TB storage box:

```ts
import { StorageBox } from "alchemy/hetzner";

export const backups = await StorageBox("site-backups", {
  location: "fsn1",
  storageBoxType: "bx11",
  password: alchemy.secret("StrongPassword123!"),
  accessSettings: {
    ssh_enabled: true,
    samba_enabled: false
  }
});
```

## Authentication

Passwords must be provided as a `Secret`. You can also inject SSH keys for key-based authentication.

```ts
import { SSHKey, StorageBox } from "alchemy/hetzner";

const key = await SSHKey("backup-key", { ... });

await StorageBox("data", {
  // ...
  sshKeys: [key]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `storageBoxType` | `HetznerStorageBoxType` | The tier (e.g., `bx11`, `bx21`). |
| `location` | `HetznerLocation` | Physical location (e.g., `fsn1`). |
| `password` | `Secret` | Initial administrative password. |
| `accessSettings` | `Object` | Toggle FTP, SSH, Samba, WebDAV, etc. |
| `sshKeys` | `Array` | List of SSH keys to inject. |

## Outputs

- `server`: The storage server hostname (e.g., `u12345.your-storagebox.de`).
- `username`: The automatically assigned username.
- `password`: The current administrative password (wrapped in a `Secret`).
