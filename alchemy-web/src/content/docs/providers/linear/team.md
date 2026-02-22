---
title: Team
description: Create and manage teams in Linear using Alchemy.
---

A Team is the fundamental organizational unit in Linear.

## Quick Start

Create a new engineering team:

```ts
import { Team } from "alchemy/linear";

export const eng = await Team("engineering", {
  name: "Engineering",
  key: "ENG",
  description: "Product engineering and development"
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The display name of the team. |
| `key` | `string` | The unique identifier key (e.g., `ENG`). |
| `description` | `string` | Optional team description. |
| `adopt` | `boolean` | Whether to adopt an existing team by key (default: `false`). |

## Deletion

Deleting a `Team` resource in Alchemy **archives** the team in Linear to preserve historical data.
