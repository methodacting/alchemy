---
title: Page
description: Create individual documents or database entries in Notion.
---

A Page in Notion can be a standalone document or an entry within a database.

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

To create an entry in a database, set the database as the parent:

```ts
import { Database, Page } from "alchemy/notion";

const db = await Database("tasks", { ... });

await Page("task-1", {
  parent: db,
  properties: {
    "Name": { title: [{ text: { content: "Fix bug" } }] },
    "Status": { select: { name: "Todo" } }
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `parent` | `string \| Page \| Database` | The parent container ID or resource. |
| `properties` | `Object` | Data matching the parent container's schema. |
| `icon` | `Object` | Optional emoji or external image icon. |
| `cover` | `Object` | Optional cover image. |
| `children` | `Array` | Initial block content for the page. |
