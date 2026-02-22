import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { Secret } from "../../secret.ts";
import { createTwitchClient, type TwitchApiOptions } from "./client.ts";

export interface EventSubscriptionCondition {
  [key: string]: string;
}

export interface EventSubscriptionProps extends TwitchApiOptions {
  /**
   * Subscription type (e.g. "stream.online", "channel.follow")
   */
  type: string;

  /**
   * Version of the subscription type
   * @default "1"
   */
  version?: string;

  /**
   * Condition object for the subscription
   */
  condition: EventSubscriptionCondition;

  /**
   * Webhook callback URL
   */
  callback: string;

  /**
   * Webhook secret
   */
  secret: string | Secret;

  /**
   * Broadcaster ID (optional, resolved from refresh token if omitted)
   */
  broadcasterId?: string;

  /**
   * Whether to adopt an existing subscription by type+condition
   * @default false
   */
  adopt?: boolean;
}

export type EventSubscription = Omit<
  EventSubscriptionProps,
  "clientId" | "clientSecret" | "refreshToken" | "adopt"
> &
  Resource<"twitch::EventSubscription"> & {
    /**
     * Subscription ID.
     */
    id: string;

    /**
     * Subscription status.
     */
    status: string;

    /**
     * Webhook secret.
     */
    secret: Secret;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "twitch::EventSubscription";
  };

const EVENTSUB_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";

type EventSubSubscription = {
  id: string;
  type: string;
  version: string;
  status: string;
  condition: EventSubscriptionCondition;
};

async function listSubscriptions(
  clientId: string,
  accessToken: string,
): Promise<EventSubSubscription[]> {
  const response = await fetch(EVENTSUB_URL, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twitch EventSub list failed (${response.status}): ${text}`,
    );
  }
  const json = (await response.json()) as { data: EventSubSubscription[] };
  return json.data ?? [];
}

async function createSubscription(
  clientId: string,
  accessToken: string,
  body: {
    type: string;
    version: string;
    condition: EventSubscriptionCondition;
    transport: {
      method: "webhook";
      callback: string;
      secret: string;
    };
  },
): Promise<EventSubSubscription | undefined> {
  const response = await fetch(EVENTSUB_URL, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twitch EventSub create failed (${response.status}): ${text}`,
    );
  }
  const json = (await response.json()) as { data: EventSubSubscription[] };
  return json.data?.[0];
}

async function deleteSubscription(
  clientId: string,
  accessToken: string,
  id: string,
) {
  const url = new URL(EVENTSUB_URL);
  url.searchParams.set("id", id);
  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(
      `Twitch EventSub delete failed (${response.status}): ${text}`,
    );
  }
}

/**
 * Manages a Twitch EventSub Webhook subscription.
 */
export const EventSubscription = Resource(
  "twitch::EventSubscription",
  async function (
    this: Context<EventSubscription>,
    _id: string,
    props: EventSubscriptionProps,
  ): Promise<EventSubscription> {
    const condition = {
      ...props.condition,
      broadcaster_user_id:
        props.condition.broadcaster_user_id ?? props.broadcasterId ?? "local",
    };

    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const { clientId, accessToken } = await createTwitchClient(props);

      if (this.output?.id) {
        await deleteSubscription(clientId, accessToken, this.output.id);
      }
      return this.destroy();
    }

    if (this.scope.local) {
      const localId = this.output?.id ?? `${_id}-local`;
      return {
        id: localId,
        type: props.type,
        version: props.version ?? "1",
        condition,
        callback: props.callback,
        secret: Secret.wrap(props.secret),
        status: "enabled",
        broadcasterId: props.broadcasterId ?? "local",
        type: "twitch::EventSubscription",
      };
    }

    const { clientId, accessToken, userId } = await createTwitchClient(props);
    const broadcasterId = props.broadcasterId ?? userId;
    const normalizedCondition = {
      ...condition,
      broadcaster_user_id: condition.broadcaster_user_id ?? broadcasterId,
    };

    let subscriptionId = this.output?.id;
    let subscription: EventSubSubscription | undefined;

    if (this.phase === "create" || !subscriptionId) {
      if (props.adopt && !this.isReplacement) {
        const existing = await listSubscriptions(clientId, accessToken);
        subscription = existing.find(
          (s) =>
            s.type === props.type &&
            JSON.stringify(s.condition) === JSON.stringify(normalizedCondition),
        );
        if (subscription) {
          subscriptionId = subscription.id;
        }
      }

      if (!subscriptionId || this.isReplacement) {
        subscription = await createSubscription(clientId, accessToken, {
          type: props.type,
          version: props.version ?? "1",
          condition: normalizedCondition,
          transport: {
            method: "webhook",
            callback: props.callback,
            secret: Secret.unwrap(props.secret),
          },
        });
        subscriptionId = subscription?.id;
      }
    } else {
      // Twitch EventSub does not support update; replace on changes
      if (
        props.type !== this.output.type ||
        props.callback !== this.output.callback ||
        Secret.unwrap(props.secret) !== Secret.unwrap(this.output.secret) ||
        JSON.stringify(normalizedCondition) !==
          JSON.stringify(this.output.condition)
      ) {
        await deleteSubscription(clientId, accessToken, subscriptionId);
        subscription = await createSubscription(clientId, accessToken, {
          type: props.type,
          version: props.version ?? "1",
          condition: normalizedCondition,
          transport: {
            method: "webhook",
            callback: props.callback,
            secret: Secret.unwrap(props.secret),
          },
        });
        subscriptionId = subscription?.id;
      } else {
        const existing = await listSubscriptions(clientId, accessToken);
        subscription = existing.find((s) => s.id === subscriptionId);
      }
    }

    if (!subscription) {
      throw new Error(
        `Failed to resolve EventSub subscription ${subscriptionId}`,
      );
    }

    return {
      id: subscription.id,
      type: subscription.type,
      version: subscription.version,
      condition: normalizedCondition,
      callback: props.callback,
      secret: Secret.wrap(props.secret),
      status: subscription.status,
      broadcasterId,
      type: "twitch::EventSubscription",
    };
  },
);

/**
 * Type guard for EventSubscription resource
 */
export function isEventSubscription(
  resource: unknown,
): resource is EventSubscription {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "twitch::EventSubscription"
  );
}
