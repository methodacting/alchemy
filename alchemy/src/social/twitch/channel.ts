import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createTwitchClient, type TwitchApiOptions } from "./client.ts";

export interface TwitchChannelProps extends TwitchApiOptions {
  /**
   * Broadcaster ID (optional, resolved from refresh token if omitted)
   */
  broadcasterId?: string;

  /**
   * Stream title
   */
  title?: string;

  /**
   * Game name (resolved to ID)
   */
  game?: string;

  /**
   * Stream tags
   */
  tags?: string[];

  /**
   * Classification labels
   */
  classifications?: Array<{ id: string; isEnabled?: boolean } | string>;
}

export type TwitchChannel = Omit<
  TwitchChannelProps,
  "clientId" | "clientSecret" | "refreshToken" | "classifications"
> &
  Resource<"twitch::Channel"> & {
    /**
     * Broadcaster ID.
     */
    id: string;

    /**
     * Resolved game ID (if provided).
     */
    gameId?: string;

    /**
     * Resolved game name (if available).
     */
    gameName?: string;

    /**
     * Channel tags.
     */
    tags?: string[];

    /**
     * Resource type identifier.
     * @internal
     */
    type: "twitch::Channel";
  };

/**
 * Manages a Twitch Channel's broadcast settings.
 */
export const Channel = Resource(
  "twitch::Channel",
  async function (
    this: Context<TwitchChannel>,
    _id: string,
    props: TwitchChannelProps,
  ): Promise<TwitchChannel> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const broadcasterId = props.broadcasterId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: broadcasterId,
        broadcasterId,
        title: props.title,
        gameId: undefined,
        gameName: props.game,
        tags: props.tags,
        type: "twitch::Channel",
      };
    }

    const { client, userId } = await createTwitchClient(props);
    const resolvedBroadcasterId = props.broadcasterId ?? userId;

    let gameId: string | undefined;
    if (props.game) {
      const game = await client.games.getGameByName(props.game);
      if (!game) {
        throw new Error(`Twitch game not found: ${props.game}`);
      }
      gameId = game.id;
    }

    const classifications = props.classifications?.map((c) =>
      typeof c === "string"
        ? { id: c, isEnabled: true }
        : { id: c.id, isEnabled: c.isEnabled ?? true },
    );

    if (this.phase === "create" || this.phase === "update") {
      const updatePayload = {
        title: props.title ?? this.output?.title,
        gameId: gameId ?? this.output?.gameId,
        tags: props.tags ?? this.output?.tags,
        contentClassificationLabels: classifications,
      };

      await client.channels.updateChannelInfo(
        resolvedBroadcasterId,
        updatePayload as Parameters<
          typeof client.channels.updateChannelInfo
        >[1],
      );
    }

    const channelInfo = await client.channels.getChannelInfoById(
      resolvedBroadcasterId,
    );

    return {
      id: resolvedBroadcasterId,
      broadcasterId: resolvedBroadcasterId,
      title: channelInfo?.title ?? props.title,
      gameId: channelInfo?.gameId ?? gameId,
      gameName: channelInfo?.gameName ?? props.game,
      tags: channelInfo?.tags ?? props.tags,
      type: "twitch::Channel",
    };
  },
);

/**
 * Type guard for TwitchChannel resource
 */
export function isChannel(resource: unknown): resource is TwitchChannel {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "twitch::Channel"
  );
}
