import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createTwitchClient, type TwitchApiOptions } from "./client.ts";

export interface TwitchBlockedTermProps extends TwitchApiOptions {
  /**
   * Broadcaster ID (optional, resolved from refresh token if omitted)
   */
  broadcasterId?: string;

  /**
   * Moderator ID (optional, resolved from refresh token if omitted)
   */
  moderatorId?: string;

  /**
   * Blocked term text
   */
  text: string;

  /**
   * Blocked term ID (optional override)
   */
  termId?: string;

  /**
   * Whether to adopt an existing term by text
   * @default false
   */
  adopt?: boolean;
}

export type TwitchBlockedTerm = Omit<
  TwitchBlockedTermProps,
  "clientId" | "clientSecret" | "refreshToken" | "adopt"
> &
  Resource<"twitch::BlockedTerm"> & {
    /**
     * Blocked term ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "twitch::BlockedTerm";
  };

type BlockedTermRecord = {
  id: string;
  text: string;
};

/**
 * Manages a Twitch blocked term entry.
 */
export const BlockedTerm = Resource(
  "twitch::BlockedTerm",
  async function (
    this: Context<TwitchBlockedTerm>,
    _id: string,
    props: TwitchBlockedTermProps,
  ): Promise<TwitchBlockedTerm> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const { client, userId } = await createTwitchClient(props);
      const broadcasterId = props.broadcasterId ?? userId;
      const moderatorId = props.moderatorId ?? userId;
      const termId = props.termId ?? this.output?.id;
      if (termId) {
        await client.moderation.removeBlockedTerm(
          broadcasterId,
          moderatorId,
          termId,
        );
      }
      return this.destroy();
    }

    const broadcasterId =
      props.broadcasterId ?? this.output?.broadcasterId ?? "local";
    const moderatorId =
      props.moderatorId ?? this.output?.moderatorId ?? "local";

    if (this.scope.local) {
      return {
        id: props.termId ?? this.output?.id ?? `${_id}-local`,
        broadcasterId,
        moderatorId,
        text: props.text,
        termId: props.termId ?? this.output?.id ?? `${_id}-local`,
        type: "twitch::BlockedTerm",
      };
    }

    const { client, userId } = await createTwitchClient(props);
    const resolvedBroadcasterId = props.broadcasterId ?? userId;
    const resolvedModeratorId = props.moderatorId ?? userId;

    let termId = props.termId ?? this.output?.id;
    let term: BlockedTermRecord | undefined;

    if (this.phase === "create" || !termId) {
      if (props.adopt && !this.isReplacement) {
        const existing = await client.moderation.getBlockedTerms(
          resolvedBroadcasterId,
          resolvedModeratorId,
        );
        term = (existing.data as BlockedTermRecord[]).find(
          (t) => t.text === props.text,
        );
        if (term) {
          termId = term.id;
        }
      }

      if (!termId || this.isReplacement) {
        term = (await client.moderation.addBlockedTerm(
          resolvedBroadcasterId,
          resolvedModeratorId,
          props.text,
        )) as unknown as BlockedTermRecord;
        termId = term.id;
      }
    } else if (props.text !== this.output?.text) {
      await client.moderation.removeBlockedTerm(
        resolvedBroadcasterId,
        resolvedModeratorId,
        termId,
      );
      term = (await client.moderation.addBlockedTerm(
        resolvedBroadcasterId,
        resolvedModeratorId,
        props.text,
      )) as unknown as BlockedTermRecord;
      termId = term.id;
    } else {
      term = {
        id: termId,
        text: props.text,
      };
    }

    if (!term || !termId) {
      throw new Error("Failed to resolve blocked term");
    }

    return {
      id: termId,
      broadcasterId: resolvedBroadcasterId,
      moderatorId: resolvedModeratorId,
      text: term.text,
      termId,
      type: "twitch::BlockedTerm",
    };
  },
);

/**
 * Type guard for TwitchBlockedTerm resource.
 */
export function isBlockedTerm(
  resource: unknown,
): resource is TwitchBlockedTerm {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "twitch::BlockedTerm"
  );
}
