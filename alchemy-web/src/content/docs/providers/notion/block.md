---
title: Block
description: Manage rich content blocks within Notion pages.
---

The `Block` resource allows you to declaratively define the structure and content of your Notion pages.

## Quick Start

Create a heading and a paragraph:

```ts
import { Block } from "alchemy/notion";

const header = await Block("h1", {
  parent: "PAGE_ID",
  block: {
    type: "heading_1",
    heading_1: { rich_text: [{ text: { content: "System Specs" } }] }
  }
});

await Block("text", {
  parent: "PAGE_ID",
  block: {
    type: "paragraph",
    paragraph: {
      rich_text: [{ text: { content: "This page is managed by Alchemy." } }]
    }
  }
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `parent` | `string \| Page \| Block` | The parent container (Page or another Block). |
| `block` | `BlockObjectRequest` | The block content matching Notion's API. |

## Content Types

Supports all standard Notion block types including `code`, `callout`, `divider`, `image`, and `bulleted_list_item`. Nested blocks are supported via the `parent` property or by including `children` within the `block` object.
