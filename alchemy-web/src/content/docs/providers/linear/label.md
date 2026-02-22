---
title: Label
description: Standardize issue categorization with Linear Labels.
---

Labels are used to categorize and filter issues within your workspace or specific teams.

## Quick Start

Create a workspace-level "Bug" label:

```ts
import { Label } from "alchemy/linear";

export const bug = await Label("bug", {
  name: "Bug",
  color: "#eb5757"
});
```

## Team Labels

Associate a label with a specific team:

```ts
import { Team, Label } from "alchemy/linear";

const eng = await Team("eng", { ... });

await Label("eng-bug", {
  name: "Internal Bug",
  color: "#3498db",
  team: eng
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The display name of the label. |
| `color` | `string` | Hex color code (e.g., `#eb5757`). |
| `team` | `string \| Team` | Optional association with a team. |
| `adopt` | `boolean` | Whether to adopt an existing label by name (default: `false`). |
