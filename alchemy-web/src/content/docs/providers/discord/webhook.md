---
title: Webhook
description: Create and manage Discord channel webhooks for automated messaging.
---

Webhooks are the easiest way to send automated messages to a Discord channel from external services.

## Quick Start

Create a webhook for infrastructure alerts:

```ts
import { Webhook } from "alchemy/discord";

export const hook = await Webhook("ops-bot", {
  channel: "123...",
  name: "Alchemy Monitor"
});

console.log(`URL: ${hook.url}`);
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `channel` | `string \| Channel` | The channel where messages will be posted. |
| `name` | `string` | Name of the webhook bot. |
| `avatar` | `string` | Base64 encoded image for the bot avatar. |

## Outputs

- `url`: The full webhook URL (including the token). **Keep this secret.**
- `token`: The secure token for the webhook.
