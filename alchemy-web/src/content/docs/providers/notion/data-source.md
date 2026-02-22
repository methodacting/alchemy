---
title: Data Source
description: Manage schemas and tables within Notion Databases.
---

A **Data Source** represents the actual content and schema (properties) within a Database container.

## Quick Start

Create a data source with a specific schema:

```ts
import { DataSource } from "alchemy/notion";

export const tasks = await DataSource("tasks", {
  database: "DATABASE_ID",
  title: "Inventory",
  properties: {
    "Item": { title: {} },
    "Quantity": { number: {} },
    "Priority": { select: { options: [{ name: "High" }, { name: "Low" }] } }
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `database` | `string \| Database` | The parent database container. |
| `title` | `string` | The title of the data source. |
| `properties` | `Object` | Schema definition for the columns. |
| `adopt` | `boolean` | Whether to adopt an existing data source by ID or title. |

## Integration

Use the `DataSource` as a parent for [Page](./page.md) resources to create entries in the table.
