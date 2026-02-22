import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import { isRole, type Role } from "./role.ts";
import type { DiscordApiEmoji } from "./types.ts";

export interface EmojiProps extends DiscordApiOptions {
  /**
   * The guild to create the emoji in
   */
  guild: string | Guild;

  /**
   * Name of the emoji
   */
  name: string;

  /**
   * The 128x128 image data as a data URL or base64 string
   * Example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
   */
  image: string;

  /**
   * Roles allowed to use this emoji
   */
  roles?: Array<string | Role>;

  /**
   * Whether to adopt an existing emoji by name
   * @default false
   */
  adopt?: boolean;
}

export type Emoji = Omit<
  EmojiProps,
  "token" | "botToken" | "guild" | "roles" | "image" | "adopt"
> &
  Resource<"discord::Emoji"> & {
    id: string;
    guildId: string;
    roleIds?: string[];
    animated: boolean;
    available: boolean;
  };

type EmojiPropsNormalized = Omit<EmojiProps, "guild" | "roles"> & {
  guild: string;
  roles?: string[];
};

export function Emoji(id: string, props: EmojiProps): Promise<Emoji> {
  return _Emoji(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
    roles: props.roles?.map((role) =>
      isRole(role) ? role.id : role.toString(),
    ),
  });
}

/**
 * Manages a Discord Custom Emoji.
 *
 * @example
 * await Emoji("logo", {
 *   guild: guildId,
 *   name: "alchemy",
 *   image: "data:image/png;base64,..."
 * });
 */
const _Emoji = Resource(
  "discord::Emoji",
  async function (
    this: Context<Emoji>,
    _id: string,
    props: EmojiPropsNormalized,
  ): Promise<Emoji> {
    const api = createDiscordApi(props);
    const guildId = props.guild;
    const roleIds = props.roles;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/guilds/${guildId}/emojis/${this.output.id}`);
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let emojiId = this.output?.id;
    let emojiData: DiscordApiEmoji | undefined;

    if (this.phase === "create" || !emojiId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const emojis = await api.get<DiscordApiEmoji[]>(
            `/guilds/${guildId}/emojis`,
          );
          emojiData = emojis.find((e) => e.name === props.name);
          if (emojiData) {
            emojiId = emojiData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!emojiId || this.isReplacement) {
        emojiData = await api.post<DiscordApiEmoji>(
          `/guilds/${guildId}/emojis`,
          {
            name: props.name,
            image: props.image,
            roles: roleIds,
          },
        );
        emojiId = emojiData.id;
      }
    } else {
      // Update mutable properties (name and roles)
      if (
        props.name !== this.output.name ||
        JSON.stringify(roleIds) !== JSON.stringify(this.output.roleIds)
      ) {
        emojiData = await api.patch<DiscordApiEmoji>(
          `/guilds/${guildId}/emojis/${emojiId}`,
          {
            name: props.name,
            roles: roleIds,
          },
        );
      } else {
        emojiData = await api.get<DiscordApiEmoji>(
          `/guilds/${guildId}/emojis/${emojiId}`,
        );
      }
    }

    if (!emojiData) {
      throw new Error(`Failed to find emoji ${emojiId}`);
    }

    return {
      id: emojiData.id,
      guildId,
      name: emojiData.name,
      roleIds: emojiData.roles,
      animated: emojiData.animated ?? false,
      available: emojiData.available ?? true,
      type: "discord::Emoji",
    } as any as Emoji;
  },
);

/**
 * Type guard for Emoji resource
 */
export function isEmoji(resource: unknown): resource is Emoji {
  return (resource as any)?.[ResourceKind] === "discord::Emoji";
}
