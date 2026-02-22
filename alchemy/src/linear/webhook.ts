import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createLinearClient,
  linearGraphql,
  type LinearApiOptions,
} from "./api.ts";
import { isTeam, type LinearTeam } from "./team.ts";
import {
  WEBHOOK_CREATE_MUTATION,
  WEBHOOK_DELETE_MUTATION,
  WEBHOOK_QUERY,
  WEBHOOK_UPDATE_MUTATION,
  WEBHOOKS_QUERY,
} from "./graphql.ts";
import type {
  LinearWebhookNode,
  WebhookCreateResponse,
  WebhookDeleteResponse,
  WebhookQueryResponse,
  WebhookUpdateResponse,
  WebhooksQueryResponse,
} from "./queries.ts";

export interface WebhookProps extends LinearApiOptions {
  /**
   * The URL to send the webhook to
   */
  url: string;

  /**
   * List of resource types to trigger the webhook (e.g. ["Issue", "Project"])
   */
  resourceTypes: string[];

  /**
   * Team ID or Team resource associated with the webhook (optional)
   */
  team?: string | LinearTeam;

  /**
   * Whether to adopt an existing webhook by URL
   * @default false
   */
  adopt?: boolean;
}

export type LinearWebhook = Omit<
  WebhookProps,
  "adopt" | "token" | "apiKey" | "team"
> & {
  id: string;
  teamId?: string;
  type: "linear::Webhook";
};

type WebhookPropsNormalized = Omit<WebhookProps, "team"> & {
  team?: string;
};

export function Webhook(
  id: string,
  props: WebhookProps,
): Promise<LinearWebhook> {
  return _Webhook(id, {
    ...props,
    team: props.team
      ? isTeam(props.team)
        ? props.team.id
        : props.team.toString()
      : undefined,
  });
}

/**
 * Manages a Linear Webhook.
 *
 * @example
 * const hook = await Webhook("ops", {
 *   url: "https://api.example.com/webhooks/linear",
 *   resourceTypes: ["Issue", "Project"]
 * });
 */
const _Webhook = Resource(
  "linear::Webhook",
  async function (
    this: Context<LinearWebhook>,
    id: string,
    props: WebhookPropsNormalized,
  ): Promise<LinearWebhook> {
    const client = createLinearClient(props);
    const teamId = props.team;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await linearGraphql<WebhookDeleteResponse>(
            client,
            WEBHOOK_DELETE_MUTATION,
            {
              id: this.output.id,
            },
          );
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let webhookId = this.output?.id;
    let webhookData: LinearWebhookNode | undefined;

    if (this.phase === "create" || !webhookId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const existing = await linearGraphql<WebhooksQueryResponse>(
            client,
            WEBHOOKS_QUERY,
            {
              first: 50,
              filter: { url: { eq: props.url } },
            },
          );
          webhookData = existing.webhooks.nodes.find(
            (webhook) => webhook.url === props.url,
          );
          if (webhookData) {
            webhookId = webhookData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!webhookId || this.isReplacement) {
        const created = await linearGraphql<WebhookCreateResponse>(
          client,
          WEBHOOK_CREATE_MUTATION,
          {
            input: {
              url: props.url,
              resourceTypes: props.resourceTypes,
              teamId,
            },
          },
        );
        webhookData = created.webhookCreate.webhook;
        webhookId = webhookData.id;
      }
    } else {
      const updated = await linearGraphql<WebhookUpdateResponse>(
        client,
        WEBHOOK_UPDATE_MUTATION,
        {
          id: webhookId,
          input: {
            url: props.url,
            resourceTypes: props.resourceTypes,
            teamId,
          },
        },
      );
      webhookData = updated.webhookUpdate.webhook;
    }

    if (!webhookId) {
      throw new Error(`Failed to find webhook ${id}`);
    }

    if (!webhookData) {
      const fetched = await linearGraphql<WebhookQueryResponse>(
        client,
        WEBHOOK_QUERY,
        { id: webhookId },
      );
      webhookData = fetched.webhook;
    }

    return {
      id: webhookId,
      url: webhookData.url,
      resourceTypes: webhookData.resourceTypes,
      teamId: webhookData.team?.id ?? teamId,
      type: "linear::Webhook",
    };
  },
);

/**
 * Type guard for Webhook resource
 */
export function isWebhook(resource: unknown): resource is LinearWebhook {
  return (resource as any)?.[ResourceKind] === "linear::Webhook";
}
