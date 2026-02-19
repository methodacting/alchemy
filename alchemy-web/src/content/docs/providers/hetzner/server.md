---
title: Server
description: Learn how to provision and manage Hetzner Cloud Servers (VPS) using Alchemy.
---

A Hetzner Cloud Server is a virtual private server (VPS) that provides high-performance cloud computing.

## Quick Start

Deploy a standard cloud server:

```ts
import { Server } from "alchemy/hetzner";

export const web = await Server("web", {
  serverType: "cx23",
  image: "ubuntu-24.04",
  location: "hel1",
});
```

## Configuration

The `Server` resource supports a wide range of configuration options, including private networking, firewalls, and initialization scripts.

```ts
import { Server, Network, Firewall, SSHKey } from "alchemy/hetzner";

const net = await Network("main", { ipRange: "10.0.0.0/8" });
const fw = await Firewall("web-sec", { ... });
const key = await SSHKey("admin", { ... });

export const srv = await Server("app", {
  serverType: "cx23",
  image: "ubuntu-24.04",
  location: "nbg1",
  sshKeys: [key],
  networks: [net],
  firewalls: [{ firewall: fw.id }],
  userData: "#cloud-config\npackages:\n  - nginx",
  labels: { env: "prod" }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `serverType` | `HetznerServerType` | The SKU of the server (e.g., `cx23`, `cpx11`). |
| `image` | `HetznerImage` | The OS image ID or name. |
| `location` | `HetznerLocation` | Physical location (e.g., `nbg1`, `hel1`). |
| `sshKeys` | `Array<string \| SSHKey>` | List of SSH keys to inject. |
| `networks` | `Array<number \| Network>` | Private networks to attach. |
| `userData` | `string` | Cloud-init initialization script. |
| `labels` | `Record<string, string>` | Key-value pairs for organization. |
| `delete` | `boolean` | Whether to delete the server when removed from Alchemy (default: `true`). |

## Outputs

- `publicIp`: The primary IPv4 address.
- `ipv6`: The primary IPv6 address.
- `privateIps`: A mapping of network IDs to internal IP addresses.
- `rootPassword`: A `Secret` containing the generated root password (only available on creation).
