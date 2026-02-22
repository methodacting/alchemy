---
title: Database
description: Create and manage database containers in Notion.
---

In the 2025-09-03 Notion API, a **Database** acts as an organizational container or "shell" that can hold multiple linked data sources.

## Quick Start

Create a database container:

```ts
import { Database } from "alchemy/notion";

export const db = await Database("project-hub", {
  parent: "PAGE_ID",
  title: [{ text: { content: "Project Hub" } }]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `parent` | `string \| Page` | The ID or resource of the parent page. |
| `title` | `Array` | Rich text objects for the database title. |
| `icon` | `Object` | Optional emoji or external image icon. |
| `cover` | `Object` | Optional cover image. |
| `adopt` | `boolean` | Whether to adopt an existing database by ID (default: `false`). |

## Relationship with Data Sources

A `Database` container manages the high-level attributes (title, icon) but does not have its own properties or columns. Use the [Data Source](./data-source.md) resource to define the actual schema and data.
