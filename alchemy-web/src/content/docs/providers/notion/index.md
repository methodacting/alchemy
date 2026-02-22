# Notion

The Notion provider allows you to manage Notion pages, databases, and content blocks as infrastructure code.

[Official Notion Developer Portal](https://developers.notion.com/)

## Resources

- [Database](./database.md) - Create organizational database containers.
- [Data Source](./data-source.md) - Manage schemas and tables within databases.
- [Page](./page.md) - Create individual documents or database entries.
- [Block](./block.md) - Define rich content structures within pages.

## Example Usage

```ts
import { Database, DataSource, Page } from "alchemy/notion";

// 1. Create a documentation page
const docs = await Page("docs", {
  parent: "PARENT_PAGE_ID",
  properties: {
    title: [{ text: { content: "Project Documentation" } }]
  }
});

// 2. Create a database container inside that page
const db = await Database("main-hub", {
  parent: docs,
  title: [{ text: { content: "Resource Hub" } }]
});

// 3. Create a data source (table) for tasks
const tasks = await DataSource("tasks", {
  database: db,
  title: "Roadmap",
  properties: {
    "Task": { title: {} },
    "Status": { select: { options: [{ name: "Planned" }, { name: "Done" }] } }
  }
});
```
