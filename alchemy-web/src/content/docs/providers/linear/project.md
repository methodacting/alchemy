---
title: Project
description: Manage goals and milestones with Linear Projects.
---

Projects allow you to group issues and track progress toward specific goals.

## Quick Start

Create a cross-team project:

```ts
import { Team, Project } from "alchemy/linear";

const eng = await Team("eng", { ... });
const design = await Team("design", { ... });

export const launch = await Project("v1-launch", {
  name: "V1 Public Launch",
  teams: [eng, design],
  description: "Our initial public release milestone"
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The title of the project. |
| `description` | `string` | Optional project description. |
| `teams` | `Array<string \| Team>` | List of associated team resources or IDs. |
| `adopt` | `boolean` | Whether to adopt an existing project by ID (default: `false`). |
