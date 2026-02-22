import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createTwitchClient, type TwitchApiOptions } from "./client.ts";

export interface TwitchAutoModSettingsProps extends TwitchApiOptions {
  /**
   * Broadcaster ID (optional, resolved from refresh token if omitted)
   */
  broadcasterId?: string;

  /**
   * Moderator ID (optional, resolved from refresh token if omitted)
   */
  moderatorId?: string;

  /**
   * AutoMod settings payload (category -> level)
   */
  settings: Record<string, number>;
}

export type TwitchAutoModSettings = Omit<
  TwitchAutoModSettingsProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"twitch::AutoModSettings"> & {
    /**
     * Composite ID (broadcaster:moderator)
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "twitch::AutoModSettings";
  };

/**
 * Manages Twitch AutoMod settings for a channel.
 */
export const AutoModSettings = Resource(
  "twitch::AutoModSettings",
  async function (
    this: Context<TwitchAutoModSettings>,
    _id: string,
    props: TwitchAutoModSettingsProps,
  ): Promise<TwitchAutoModSettings> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const broadcasterId =
      props.broadcasterId ?? this.output?.broadcasterId ?? "local";
    const moderatorId =
      props.moderatorId ?? this.output?.moderatorId ?? "local";

    if (this.scope.local) {
      return {
        id: `${broadcasterId}:${moderatorId}`,
        broadcasterId,
        moderatorId,
        settings: props.settings,
        type: "twitch::AutoModSettings",
      };
    }

    const { client, userId } = await createTwitchClient(props);
    const resolvedBroadcasterId = props.broadcasterId ?? userId;
    const resolvedModeratorId = props.moderatorId ?? userId;

    const updated = await client.moderation.updateAutoModSettings(
      resolvedBroadcasterId,
      resolvedModeratorId,
      props.settings as Parameters<
        typeof client.moderation.updateAutoModSettings
      >[2],
    );

    return {
      id: `${resolvedBroadcasterId}:${resolvedModeratorId}`,
      broadcasterId: resolvedBroadcasterId,
      moderatorId: resolvedModeratorId,
      settings:
        (updated as unknown as Record<string, number>) ?? props.settings,
      type: "twitch::AutoModSettings",
    };
  },
);

/**
 * Type guard for TwitchAutoModSettings resource.
 */
export function isAutoModSettings(
  resource: unknown,
): resource is TwitchAutoModSettings {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "twitch::AutoModSettings"
  );
}
