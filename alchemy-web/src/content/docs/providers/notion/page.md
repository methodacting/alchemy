---
title: Page
description: Create individual documents or database entries in Notion.
---

A Page in Notion can be a standalone document or an entry within a Data Source.

## Quick Start

Create a standalone page:

```ts
import { Page } from "alchemy/notion";

export const doc = await Page("my-doc", {
  parent: "PAGE_ID",
  properties: {
    title: [{ text: { content: "My Documentation" } }]
  }
});
```

## Database Entries

To create an entry in a database, set the [Data Source](./data-source.md) as the parent:

```ts
import { DataSource, Page } from "alchemy/notion";

const table = await DataSource("tasks", { ... });

await Page("task-1", {
  parent: table,
  properties: {
    "Name": { title: [{ text: { content: "Fix bug" } }] },
    "Status": { select: { name: "Planned" } }
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `parent` | `string \| Page \| DataSource` | The parent container ID or resource. |
| `properties` | `Object` | Data matching the parent container's schema. |
| `icon` | `Object` | Optional emoji or external image icon. |
| `cover` | `Object` | Optional cover image. |
| `children` | `Array` | Initial block content for the page. |
| `adopt` | `boolean` | Whether to adopt an existing page by ID. |
