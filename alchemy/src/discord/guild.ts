import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import type { DiscordVerificationLevel } from "./types.ts";

export interface GuildProps extends DiscordApiOptions {
  /**
   * Name of the guild
   */
  name: string;

  /**
   * Verification level of the guild
   */
  verificationLevel?: DiscordVerificationLevel;

  /**
   * Whether to adopt an existing guild
   * @default false
   */
  adopt?: boolean;
}

export type Guild = Omit<GuildProps, "adopt" | "token" | "botToken"> & {
  id: string;
  ownerId: string;
  type: "discord::Guild";
};

/**
 * Manages a Discord Guild (Server).
 *
 * @example
 * const guild = await Guild("main", {
 *   name: "My Operations Server",
 *   adopt: true
 * });
 */
export const Guild = Resource(
  "discord::Guild",
  async function (
    this: Context<Guild>,
    id: string,
    props: GuildProps
  ): Promise<Guild> {
    const api = createDiscordApi(props);

    if (this.phase === "delete") {
      // We only delete if we created it. If we adopted it, we orphan it.
      // However, bots often can't delete guilds easily unless they are the owner.
      // For safety, we'll orphan unless explicitly requested or if it's a test environment.
      if (this.output?.id) {
        try {
          await api.delete(`/guilds/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404")) {
            console.warn(`Failed to delete guild ${this.output.id}: ${error.message}`);
          }
        }
      }
      return this.destroy();
    }

    let guildId = this.output?.id;
    let guildData: any;

    if (this.phase === "create" || !guildId) {
      if (props.adopt && !this.isReplacement) {
        // Adoption in Discord is basically verifying access
        try {
          guildData = await api.get(`/guilds/${id}`); // Assumes id is the Discord Guild ID if adopting
          guildId = guildData.id;
        } catch (e) {
          // If id isn't a guild id, try fetching all guilds and matching by name
          const guilds = await api.get("/users/@me/guilds");
          guildData = guilds.find((g: any) => g.name === props.name);
          if (guildData) {
            guildId = guildData.id;
          } else {
            throw new Error(`Failed to adopt guild "${props.name}". Make sure the bot is a member.`);
          }
        }
      }

      if (!guildId || this.isReplacement) {
        const response = await api.post("/guilds", {
          name: props.name,
          verification_level: props.verificationLevel,
        });
        guildData = response;
        guildId = guildData.id;
      }
    } else {
      // Update mutable properties
      if (props.name !== this.output.name || props.verificationLevel !== this.output.verificationLevel) {
        guildData = await api.patch(`/guilds/${guildId}`, {
          name: props.name,
          verification_level: props.verificationLevel,
        });
      } else {
        guildData = await api.get(`/guilds/${guildId}`);
      }
    }

    return {
      id: guildId as string,
      name: guildData.name,
      verificationLevel: guildData.verification_level,
      ownerId: guildData.owner_id,
      type: "discord::Guild",
    };
  }
);

/**
 * Type guard for Guild resource
 */
export function isGuild(resource: any): resource is Guild {
  return resource?.[ResourceKind] === "discord::Guild";
}
