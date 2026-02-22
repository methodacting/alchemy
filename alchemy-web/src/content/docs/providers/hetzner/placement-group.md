---
title: Placement Group
description: Manage server scheduling policies using Placement Groups.
---

Placement Groups influence where your servers are physically located in the data center to improve high availability.

## Quick Start

Create a `spread` placement group:

```ts
import { PlacementGroup } from "alchemy/hetzner";

export const pg = await PlacementGroup("ha-cluster", {
  type: "spread"
});
```

## Usage

Assign multiple servers to the same group to ensure they run on different physical host machines.

```ts
import { Server, PlacementGroup } from "alchemy/hetzner";

const pg = await PlacementGroup("web-group", { type: "spread" });

await Server("web-1", { placementGroup: pg, ... });
await Server("web-2", { placementGroup: pg, ... });
```

:::note
Hetzner currently only supports the `spread` type, which guarantees that all members of the group are on different hypervisors.
:::

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `type` | `"spread"` | The placement strategy (default: `spread`). |
| `labels` | `Record<string, string>` | organization labels. |
