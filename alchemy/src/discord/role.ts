import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import { DiscordPermissions, type DiscordPermissionName } from "./types.ts";

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

export type Role = Omit<RoleProps, "adopt" | "token" | "botToken" | "guild" | "permissions"> & {
  id: string;
  guildId: string;
  permissions: string;
  type: "discord::Role";
};

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
export const Role = Resource(
  "discord::Role",
  async function (
    this: Context<Role>,
    id: string,
    props: RoleProps
  ): Promise<Role> {
    const api = createDiscordApi(props);
    const guildId = isGuild(props.guild) ? props.guild.id : props.guild.toString();

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
        } catch (error: any) {
          if (!error.message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let roleId = this.output?.id;
    let roleData: any;

    if (this.phase === "create" || !roleId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const roles = await api.get(`/guilds/${guildId}/roles`);
          roleData = roles.find((r: any) => r.name === props.name);
          if (roleData) {
            roleId = roleData.id;
          }
        } catch (e) { /* ignore */ }
      }

      if (!roleId || this.isReplacement) {
        const response = await api.post(`/guilds/${guildId}/roles`, {
          name: props.name,
          color: props.color,
          hoist: props.hoist,
          mentionable: props.mentionable,
          permissions,
        });
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
        roleData = await api.patch(`/guilds/${guildId}/roles/${roleId}`, {
          name: props.name,
          color: props.color,
          hoist: props.hoist,
          mentionable: props.mentionable,
          permissions,
        });
      } else {
        const roles = await api.get(`/guilds/${guildId}/roles`);
        roleData = roles.find((r: any) => r.id === roleId);
      }
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
    };
  }
);

/**
 * Type guard for Role resource
 */
export function isRole(resource: any): resource is Role {
  return resource?.[ResourceKind] === "discord::Role";
}
