import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isChannel, type Channel } from "./channel.ts";
import { isRole, type Role } from "./role.ts";
import {
  DiscordPermissions,
  type DiscordPermissionName,
  DiscordPermissionOverwriteType,
} from "./types.ts";

export interface PermissionOverwriteProps extends DiscordApiOptions {
  /**
   * The channel to apply the overwrite to
   */
  channel: string | Channel;

  /**
   * The target role or member ID or resource
   */
  target: string | Role;

  /**
   * Type of overwrite
   * @default inferred from target (Role if Role resource or ID, Member otherwise)
   */
  targetType?: DiscordPermissionOverwriteType;

  /**
   * Permissions to allow
   */
  allow?: Partial<Record<DiscordPermissionName, boolean>>;

  /**
   * Permissions to deny
   */
  deny?: Partial<Record<DiscordPermissionName, boolean>>;
}

export interface PermissionOverwrite extends Omit<
  PermissionOverwriteProps,
  "token" | "botToken" | "channel" | "target" | "allow" | "deny"
> {
  id: string;
  channelId: string;
  targetId: string;
  allow: string;
  deny: string;
  overwriteType: DiscordPermissionOverwriteType;
}

type PermissionOverwritePropsNormalized = Omit<
  PermissionOverwriteProps,
  "channel" | "target"
> & {
  channel: string;
  target: string;
};

export function PermissionOverwrite(
  id: string,
  props: PermissionOverwriteProps,
): Promise<PermissionOverwrite> {
  const inferredType =
    props.targetType ??
    (isRole(props.target)
      ? DiscordPermissionOverwriteType.Role
      : DiscordPermissionOverwriteType.Member);
  return _PermissionOverwrite(id, {
    ...props,
    channel: isChannel(props.channel)
      ? props.channel.id
      : props.channel.toString(),
    target: isRole(props.target) ? props.target.id : props.target.toString(),
    targetType: inferredType,
  });
}

function toBitmask(
  permissions?: Partial<Record<DiscordPermissionName, boolean>>,
): string {
  let bitmask = 0n;
  if (permissions) {
    for (const [name, enabled] of Object.entries(permissions)) {
      if (enabled) {
        const bit = DiscordPermissions[name as DiscordPermissionName];
        if (bit !== undefined) {
          bitmask |= bit;
        }
      }
    }
  }
  return bitmask.toString();
}

/**
 * Manages a Discord Channel Permission Overwrite.
 *
 * @example
 * await PermissionOverwrite("lockdown", {
 *   channel: alertsChannel,
 *   target: guildId, // @everyone
 *   deny: {
 *     SendMessages: true
 *   }
 * });
 */
const _PermissionOverwrite = Resource(
  "discord::PermissionOverwrite",
  async function (
    this: Context<PermissionOverwrite>,
    _id: string,
    props: PermissionOverwritePropsNormalized,
  ): Promise<PermissionOverwrite> {
    const api = createDiscordApi(props);
    const channelId = props.channel;
    const targetId = props.target;

    const overwriteType =
      props.targetType ?? DiscordPermissionOverwriteType.Role;

    const allow = toBitmask(props.allow);
    const deny = toBitmask(props.deny);

    if (this.phase === "delete") {
      if (this.output?.channelId && this.output?.targetId) {
        try {
          await api.delete(
            `/channels/${this.output.channelId}/permissions/${this.output.targetId}`,
          );
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    // Discord PUT /channels/{channel.id}/permissions/{overwrite.id}
    // creates or replaces the overwrite.
    await api.put(`/channels/${channelId}/permissions/${targetId}`, {
      allow,
      deny,
      type: overwriteType,
    });

    return {
      ...props,
      id: `${channelId}-${targetId}`,
      channelId,
      targetId,
      allow,
      deny,
      overwriteType,
    };
  },
);

/**
 * Type guard for PermissionOverwrite resource
 */
export function isPermissionOverwrite(
  resource: unknown,
): resource is PermissionOverwrite {
  return (resource as any)?.[ResourceKind] === "discord::PermissionOverwrite";
}
