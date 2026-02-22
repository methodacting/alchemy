import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isChannel, type Channel } from "./channel.ts";
import type { DiscordApiInvite } from "./types.ts";

export interface InviteProps extends DiscordApiOptions {
  /**
   * The channel to create the invite for
   */
  channel: string | Channel;

  /**
   * Duration of invite in seconds before expiry
   * @default 86400 (24 hours)
   * Set to 0 for never-expiring
   */
  maxAge?: number;

  /**
   * Max number of uses or 0 for unlimited
   * @default 0
   */
  maxUses?: number;

  /**
   * Whether this invite only grants temporary membership
   * @default false
   */
  temporary?: boolean;

  /**
   * Whether to reuse a similar invite if it already exists
   * @default false
   */
  unique?: boolean;
}

export type Invite = Omit<InviteProps, "token" | "botToken" | "channel"> &
  Resource<"discord::Invite"> & {
    id: string; // The invite code
    code: string;
    url: string;
    channelId: string;
    guildId?: string;
  };

type InvitePropsNormalized = Omit<InviteProps, "channel"> & {
  channel: string;
};

export function Invite(id: string, props: InviteProps): Promise<Invite> {
  return _Invite(id, {
    ...props,
    channel: isChannel(props.channel)
      ? props.channel.id
      : props.channel.toString(),
  });
}

/**
 * Manages a Discord Channel Invite.
 *
 * @example
 * const invite = await Invite("main", {
 *   channel: alertsChannel,
 *   maxAge: 0, // Never expire
 *   maxUses: 0 // Unlimited uses
 * });
 *
 * console.log(`Invite URL: ${invite.url}`);
 */
const _Invite = Resource(
  "discord::Invite",
  async function (
    this: Context<Invite>,
    _id: string,
    props: InvitePropsNormalized,
  ): Promise<Invite> {
    const api = createDiscordApi(props);
    const channelId = props.channel;

    // Invite cannot be updated, so if props change we replace.
    if (this.phase === "update" && this.output) {
      if (
        this.output.maxAge !== props.maxAge ||
        this.output.maxUses !== props.maxUses ||
        this.output.temporary !== props.temporary ||
        this.output.channelId !== channelId
      ) {
        return this.replace();
      }
    }

    if (this.phase === "delete") {
      if (this.output?.code) {
        try {
          await api.delete(`/invites/${this.output.code}`);
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let inviteData: DiscordApiInvite | undefined;

    if (this.phase === "create" || !this.output) {
      const body = {
        max_age: props.maxAge,
        max_uses: props.maxUses,
        temporary: props.temporary,
        unique: props.unique,
      };

      inviteData = await api.post<DiscordApiInvite>(
        `/channels/${channelId}/invites`,
        body,
      );
    } else {
      // Fetch current state
      try {
        inviteData = await api.get<DiscordApiInvite>(
          `/invites/${this.output.code}`,
        );
      } catch (e) {
        // If not found, recreate
        return this.replace();
      }
    }

    if (!inviteData) {
      throw new Error("Failed to find or create invite");
    }

    return {
      id: inviteData.code,
      code: inviteData.code,
      url: `https://discord.gg/${inviteData.code}`,
      channelId,
      guildId: inviteData.guild?.id,
      maxAge: inviteData.max_age,
      maxUses: inviteData.max_uses,
      temporary: inviteData.temporary,
      unique: props.unique,
      type: "discord::Invite",
    } as any as Invite;
  },
);

/**
 * Type guard for Invite resource
 */
export function isInvite(resource: unknown): resource is Invite {
  return (resource as any)?.[ResourceKind] === "discord::Invite";
}
