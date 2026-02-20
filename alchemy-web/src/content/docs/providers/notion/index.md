# Notion

The Notion provider allows you to manage Notion pages and databases as infrastructure code.

[Official Notion Developer Portal](https://developers.notion.com/)

## Resources

- [Database](./database.md) - Create and manage structured databases.
- [Page](./page.md) - Create individual documents or database entries.

## Example Usage

```ts
import { Database, Page } from "alchemy/notion";

// Create a documentation page
const docs = await Page("docs", {
  parent: "PARENT_PAGE_ID",
  properties: {
    title: [{ text: { content: "Project Documentation" } }]
  }
});

// Create a database inside that page
const db = await Database("tasks", {
  parent: docs,
  title: [{ text: { content: "Roadmap" } }],
  properties: {
    "Task": { title: {} },
    "Status": { select: { options: [{ name: "Planned" }, { name: "Done" }] } }
  }
});
```
