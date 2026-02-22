import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isChannel, type Channel } from "./channel.ts";
import type { DiscordApiWebhook } from "./types.ts";

export interface WebhookProps extends DiscordApiOptions {
  /**
   * The channel to create the webhook in
   */
  channel: string | Channel;

  /**
   * Name of the webhook
   */
  name: string;

  /**
   * Base64 encoded avatar image
   */
  avatar?: string;

  /**
   * Whether to adopt an existing webhook by name
   * @default false
   */
  adopt?: boolean;
}

export interface Webhook extends WebhookProps {
  id: string;
  url: string;
  token: string;
  channelId: string;
  guildId: string;
  type: "discord::Webhook";
}

type WebhookPropsNormalized = Omit<WebhookProps, "channel"> & {
  channel: string;
};

export function Webhook(id: string, props: WebhookProps): Promise<Webhook> {
  return _Webhook(id, {
    ...props,
    channel: isChannel(props.channel)
      ? props.channel.id
      : props.channel.toString(),
  });
}

/**
 * Manages a Discord Webhook.
 *
 * @example
 * const hook = await Webhook("infra", {
 *   channel: myChannel,
 *   name: "Alchemy Alert"
 * });
 *
 * console.log(`Webhook URL: ${hook.url}`);
 */
const _Webhook = Resource(
  "discord::Webhook",
  async function (
    this: Context<Webhook>,
    id: string,
    props: WebhookPropsNormalized,
  ): Promise<Webhook> {
    const api = createDiscordApi(props);
    const channelId = props.channel;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/webhooks/${this.output.id}`);
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let webhookId = this.output?.id;
    let webhookData: DiscordApiWebhook | undefined;

    if (this.phase === "create" || !webhookId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const webhooks = await api.get<DiscordApiWebhook[]>(
            `/channels/${channelId}/webhooks`,
          );
          webhookData = webhooks.find((w) => w.name === props.name);
          if (webhookData) {
            webhookId = webhookData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!webhookId || this.isReplacement) {
        const response = await api.post<DiscordApiWebhook>(
          `/channels/${channelId}/webhooks`,
          {
            name: props.name,
            avatar: props.avatar,
          },
        );
        webhookData = response;
        webhookId = webhookData.id;
      }
    } else {
      // Update mutable properties
      if (
        props.name !== this.output.name ||
        props.avatar !== this.output.avatar
      ) {
        webhookData = await api.patch<DiscordApiWebhook>(
          `/webhooks/${webhookId}`,
          {
            name: props.name,
            avatar: props.avatar,
          },
        );
      } else {
        webhookData = await api.get<DiscordApiWebhook>(
          `/webhooks/${webhookId}`,
        );
      }
    }

    if (!webhookData) {
      throw new Error(`Failed to find webhook ${webhookId}`);
    }

    return {
      ...props,
      id: webhookId as string,
      name: webhookData.name,
      avatar: webhookData.avatar,
      url: `https://discord.com/api/webhooks/${webhookData.id}/${webhookData.token}`,
      token: webhookData.token ?? "",
      channelId: webhookData.channel_id,
      guildId: webhookData.guild_id ?? "",
      type: "discord::Webhook",
    } as any as Webhook;
  },
);

/**
 * Type guard for Webhook resource
 */
export function isWebhook(resource: unknown): resource is Webhook {
  return (resource as any)?.[ResourceKind] === "discord::Webhook";
}
