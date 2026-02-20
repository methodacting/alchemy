import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import { DiscordChannelType } from "./types.ts";

export interface ChannelProps extends DiscordApiOptions {
  /**
   * The guild to create the channel in
   */
  guild: string | Guild;

  /**
   * Name of the channel
   */
  name: string;

  /**
   * Type of the channel
   * @default DiscordChannelType.GuildText
   */
  type?: DiscordChannelType;

  /**
   * The parent category ID or Channel resource
   */
  parentId?: string | Channel;

  /**
   * Channel topic
   */
  topic?: string;

  /**
   * Whether the channel is NSFW
   */
  nsfw?: boolean;

  /**
   * Whether to adopt an existing channel by name
   * @default false
   */
  adopt?: boolean;
}

export type Channel = Omit<ChannelProps, "adopt" | "token" | "botToken" | "guild" | "parentId"> & {
  id: string;
  guildId: string;
  parentId?: string;
  type: DiscordChannelType;
  typeKind: "discord::Channel";
};

/**
 * Manages a Discord Channel.
 *
 * @example
 * const cat = await Channel("ops", {
 *   guild: "123...",
 *   name: "Operations",
 *   type: DiscordChannelType.GuildCategory
 * });
 *
 * const chan = await Channel("alerts", {
 *   guild: "123...",
 *   name: "cloud-alerts",
 *   parentId: cat
 * });
 */
export const Channel = Resource(
  "discord::Channel",
  async function (
    this: Context<Channel>,
    id: string,
    props: ChannelProps
  ): Promise<Channel> {
    const api = createDiscordApi(props);
    const guildId = isGuild(props.guild) ? props.guild.id : props.guild.toString();
    const parentId = isChannel(props.parentId) ? props.parentId.id : props.parentId?.toString();

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/channels/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.type !== (props.type ?? DiscordChannelType.GuildText)) {
        return this.replace(true);
      }
    }

    let channelId = this.output?.id;
    let channelData: any;

    if (this.phase === "create" || !channelId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const channels = await api.get(`/guilds/${guildId}/channels`);
          channelData = channels.find((c: any) => c.name === props.name && c.type === (props.type ?? DiscordChannelType.GuildText));
          if (channelData) {
            channelId = channelData.id;
          }
        } catch (e) { /* ignore */ }
      }

      if (!channelId || this.isReplacement) {
        const response = await api.post(`/guilds/${guildId}/channels`, {
          name: props.name,
          type: props.type ?? DiscordChannelType.GuildText,
          parent_id: parentId,
          topic: props.topic,
          nsfw: props.nsfw,
        });
        channelData = response;
        channelId = channelData.id;
      }
    } else {
      // Update mutable properties
      if (
        props.name !== this.output.name ||
        props.topic !== this.output.topic ||
        props.nsfw !== this.output.nsfw ||
        parentId !== this.output.parentId
      ) {
        channelData = await api.patch(`/channels/${channelId}`, {
          name: props.name,
          topic: props.topic,
          nsfw: props.nsfw,
          parent_id: parentId,
        });
      } else {
        channelData = await api.get(`/channels/${channelId}`);
      }
    }

    return {
      id: channelId as string,
      guildId,
      name: channelData.name,
      type: channelData.type,
      parentId: channelData.parent_id,
      topic: channelData.topic,
      nsfw: channelData.nsfw,
      typeKind: "discord::Channel",
    };
  }
);

/**
 * Type guard for Channel resource
 */
export function isChannel(resource: any): resource is Channel {
  return resource?.[ResourceKind] === "discord::Channel";
}
