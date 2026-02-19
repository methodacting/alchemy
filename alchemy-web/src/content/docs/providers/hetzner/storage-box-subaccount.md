---
title: Storage Box Subaccount
description: Create and manage additional users for a Hetzner Storage Box.
---

Subaccounts allow you to delegate access to specific directories within a Storage Box with independent credentials and protocols.

## Quick Start

Create a subaccount restricted to a specific folder:

```ts
import { StorageBox, StorageBoxSubaccount } from "alchemy/hetzner";

const box = await StorageBox("main", { ... });

export const appUser = await StorageBoxSubaccount("app-1", {
  box,
  homeDirectory: "apps/app-1",
  password: alchemy.secret("SubPass123!"),
  accessSettings: {
    webdav_enabled: true
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `box` | `string \| StorageBox` | The parent Storage Box. |
| `homeDirectory` | `string` | Restricted root folder for this user. |
| `password` | `Secret` | Password for the subaccount. |
| `readOnly` | `boolean` | Whether to restrict access to read-only. |
| `accessSettings` | `Object` | Protocol toggles for this user. |

## Outputs

- `server`: The parent storage server hostname.
- `username`: The subaccount username (e.g., `u12345-sub1`).
