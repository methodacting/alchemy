---
title: Webhook
description: Integrate Linear with external systems using Webhooks.
---

Webhooks allow you to receive real-time notifications about changes in your Linear workspace.

## Quick Start

Create a webhook for issue updates:

```ts
import { Webhook } from "alchemy/linear";

export const hook = await Webhook("ops", {
  url: "https://api.example.com/webhooks/linear",
  resourceTypes: ["Issue", "Project"]
});
```

## Integration

Link your Linear events to an Alchemy-managed server or worker:

```ts
import { Webhook } from "alchemy/linear";
import { Worker } from "alchemy/cloudflare";

const handler = await Worker("handler", { ... });

await Webhook("linear-hook", {
  url: handler.url,
  resourceTypes: ["Issue"]
});
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | The destination URL for the payload. |
| `resourceTypes` | `string[]` | Types of resources to monitor (e.g., `Issue`, `Project`, `Cycle`). |
| `team` | `string \| Team` | Optional restriction to a specific team. |
