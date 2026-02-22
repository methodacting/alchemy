import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import {
  DiscordPermissions,
  type DiscordPermissionName,
  type DiscordApiRole,
} from "./types.ts";

export interface RoleProps extends DiscordApiOptions {
  /**
   * The guild to create the role in
   */
  guild: string | Guild;

  /**
   * Name of the role
   */
  name: string;

  /**
   * RGB color as integer (e.g. 0x3498db)
   */
  color?: number;

  /**
   * Whether the role should be displayed separately in the sidebar
   */
  hoist?: boolean;

  /**
   * Whether the role is mentionable
   */
  mentionable?: boolean;

  /**
   * Permissions for the role as a structured object
   */
  permissions?: Partial<Record<DiscordPermissionName, boolean>>;

  /**
   * Whether to adopt an existing role by name
   * @default false
   */
  adopt?: boolean;
}

export type Role = Omit<
  RoleProps,
  "adopt" | "token" | "botToken" | "guild" | "permissions"
> &
  Resource<"discord::Role"> & {
    id: string;
    guildId: string;
    permissions: string;
    type: "discord::Role";
  };

type RolePropsNormalized = Omit<RoleProps, "guild"> & {
  guild: string;
};

export function Role(id: string, props: RoleProps): Promise<Role> {
  return _Role(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
  });
}

/**
 * Manages a Discord Role.
 *
 * @example
 * const role = await Role("dev", {
 *   guild: "123...",
 *   name: "Developer",
 *   color: 0x3498db,
 *   permissions: {
 *     manageMessages: true,
 *     kickMembers: true
 *   }
 * });
 */
const _Role = Resource(
  "discord::Role",
  async function (
    this: Context<Role>,
    id: string,
    props: RolePropsNormalized,
  ): Promise<Role> {
    const api = createDiscordApi(props);
    const guildId = props.guild;

    // Convert permission object to bitmask string
    let permissionsBitmask = 0n;
    if (props.permissions) {
      for (const [name, enabled] of Object.entries(props.permissions)) {
        if (enabled) {
          const bit = DiscordPermissions[name as DiscordPermissionName];
          if (bit !== undefined) {
            permissionsBitmask |= bit;
          }
        }
      }
    }
    const permissions = permissionsBitmask.toString();

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/guilds/${guildId}/roles/${this.output.id}`);
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let roleId = this.output?.id;
    let roleData: DiscordApiRole | undefined;

    if (this.phase === "create" || !roleId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const roles = await api.get<DiscordApiRole[]>(
            `/guilds/${guildId}/roles`,
          );
          roleData = roles.find((r) => r.name === props.name);
          if (roleData) {
            roleId = roleData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!roleId || this.isReplacement) {
        const response = await api.post<DiscordApiRole>(
          `/guilds/${guildId}/roles`,
          {
            name: props.name,
            color: props.color,
            hoist: props.hoist,
            mentionable: props.mentionable,
            permissions,
          },
        );
        roleData = response;
        roleId = roleData.id;
      }
    } else {
      // Update mutable properties
      if (
        props.name !== this.output.name ||
        props.color !== this.output.color ||
        props.hoist !== this.output.hoist ||
        props.mentionable !== this.output.mentionable ||
        permissions !== this.output.permissions
      ) {
        roleData = await api.patch<DiscordApiRole>(
          `/guilds/${guildId}/roles/${roleId}`,
          {
            name: props.name,
            color: props.color,
            hoist: props.hoist,
            mentionable: props.mentionable,
            permissions,
          },
        );
      } else {
        const roles = await api.get<DiscordApiRole[]>(
          `/guilds/${guildId}/roles`,
        );
        roleData = roles.find((r) => r.id === roleId);
      }
    }

    if (!roleData) {
      throw new Error(`Failed to find role ${roleId}`);
    }

    return {
      id: roleId as string,
      guildId,
      name: roleData.name,
      color: roleData.color,
      hoist: roleData.hoist,
      mentionable: roleData.mentionable,
      permissions: roleData.permissions,
      type: "discord::Role",
    } as any as Role;
  },
);

/**
 * Type guard for Role resource
 */
export function isRole(resource: unknown): resource is Role {
  return (resource as any)?.[ResourceKind] === "discord::Role";
}
