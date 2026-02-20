---
title: Database
description: Create and manage structured databases in Notion using Alchemy.
---

A Database in Notion allows you to store structured data with custom properties.

## Quick Start

Create a task database:

```ts
import { Database } from "alchemy/notion";

export const db = await Database("tasks", {
  parent: "PAGE_ID",
  title: [{ text: { content: "My Tasks" } }],
  properties: {
    "Name": { title: {} },
    "Status": { select: { options: [{ name: "Todo" }, { name: "Done" }] } }
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `parent` | `string \| Page` | The ID or resource of the parent page. |
| `title` | `Array` | Rich text objects for the database title. |
| `properties` | `Object` | Schema definition for the database columns. |
| `adopt` | `boolean` | Whether to adopt an existing database by ID (default: `false`). |

## Deletion

Deleting a `Database` resource in Alchemy **archives** the database in Notion (moves it to the Trash).
