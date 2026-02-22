import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isChannel, type Channel } from "./channel.ts";
import { isGuild, type Guild } from "./guild.ts";
import {
  type DiscordApiScheduledEvent,
  DiscordScheduledEventEntityType,
  DiscordScheduledEventPrivacyLevel,
  DiscordScheduledEventStatus,
} from "./types.ts";

export interface GuildScheduledEventProps extends DiscordApiOptions {
  /**
   * The guild to create the event in
   */
  guild: string | Guild;

  /**
   * The channel to host the event in (required for Voice/Stage events)
   */
  channel?: string | Channel;

  /**
   * Name of the event (1-100 characters)
   */
  name: string;

  /**
   * Description of the event (1-1000 characters)
   */
  description?: string;

  /**
   * ISO8601 timestamp for when the event starts
   */
  startTime: string;

  /**
   * ISO8601 timestamp for when the event ends (required for External events)
   */
  endTime?: string;

  /**
   * The privacy level of the event
   * @default DiscordScheduledEventPrivacyLevel.GuildOnly
   */
  privacyLevel?: DiscordScheduledEventPrivacyLevel;

  /**
   * The type of the scheduled event
   * @default DiscordScheduledEventEntityType.Voice
   */
  entityType?: DiscordScheduledEventEntityType;

  /**
   * The status of the scheduled event
   * @default DiscordScheduledEventStatus.Scheduled
   */
  status?: DiscordScheduledEventStatus;

  /**
   * The location of the event (required for External events)
   */
  location?: string;

  /**
   * The cover image of the scheduled event (base64)
   */
  image?: string;

  /**
   * Whether to adopt an existing event by name
   * @default false
   */
  adopt?: boolean;
}

export type GuildScheduledEvent = Omit<
  GuildScheduledEventProps,
  "token" | "botToken" | "guild" | "channel" | "adopt"
> &
  Resource<"discord::GuildScheduledEvent"> & {
    id: string;
    guildId: string;
    channelId?: string;
    type: "discord::GuildScheduledEvent";
  };

type GuildScheduledEventPropsNormalized = Omit<
  GuildScheduledEventProps,
  "guild" | "channel"
> & {
  guild: string;
  channel?: string;
};

export function GuildScheduledEvent(
  id: string,
  props: GuildScheduledEventProps,
): Promise<GuildScheduledEvent> {
  return _GuildScheduledEvent(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
    channel: props.channel
      ? isChannel(props.channel)
        ? props.channel.id
        : props.channel.toString()
      : undefined,
  });
}

/**
 * Manages a Discord Guild Scheduled Event.
 *
 * @example
 * await GuildScheduledEvent("town-hall", {
 *   guild: guildId,
 *   name: "Weekly Town Hall",
 *   startTime: "2024-03-01T18:00:00Z",
 *   entityType: DiscordScheduledEventEntityType.Voice,
 *   channel: voiceChannel
 * });
 */
const _GuildScheduledEvent = Resource(
  "discord::GuildScheduledEvent",
  async function (
    this: Context<GuildScheduledEvent>,
    _id: string,
    props: GuildScheduledEventPropsNormalized,
  ): Promise<GuildScheduledEvent> {
    const api = createDiscordApi(props);
    const guildId = props.guild;
    const channelId = props.channel;

    const entityType =
      props.entityType ?? DiscordScheduledEventEntityType.Voice;
    const privacyLevel =
      props.privacyLevel ?? DiscordScheduledEventPrivacyLevel.GuildOnly;

    // Validation
    if (entityType === DiscordScheduledEventEntityType.External) {
      if (!props.endTime)
        throw new Error("endTime is required for External events");
      if (!props.location)
        throw new Error("location is required for External events");
    } else {
      if (!channelId)
        throw new Error("channel is required for Voice/Stage events");
    }

    const body = {
      name: props.name,
      description: props.description,
      scheduled_start_time: props.startTime,
      scheduled_end_time: props.endTime,
      privacy_level: privacyLevel,
      entity_type: entityType,
      channel_id: channelId,
      entity_metadata: props.location
        ? { location: props.location }
        : undefined,
      image: props.image,
      status: props.status,
    };

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(
            `/guilds/${guildId}/scheduled-events/${this.output.id}`,
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

    let eventId = this.output?.id;
    let eventData: DiscordApiScheduledEvent | undefined;

    if (this.phase === "create" || !eventId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const events = await api.get<DiscordApiScheduledEvent[]>(
            `/guilds/${guildId}/scheduled-events`,
          );
          eventData = events.find((e) => e.name === props.name);
          if (eventData) {
            eventId = eventData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!eventId || this.isReplacement) {
        eventData = await api.post<DiscordApiScheduledEvent>(
          `/guilds/${guildId}/scheduled-events`,
          body,
        );
        eventId = eventData.id;
      }
    } else {
      eventData = await api.patch<DiscordApiScheduledEvent>(
        `/guilds/${guildId}/scheduled-events/${eventId}`,
        body,
      );
    }

    if (!eventData) {
      throw new Error(`Failed to find scheduled event ${eventId}`);
    }

    return {
      id: eventData.id,
      guildId,
      channelId: eventData.channel_id,
      name: eventData.name,
      description: eventData.description,
      startTime: eventData.scheduled_start_time,
      endTime: eventData.scheduled_end_time,
      privacyLevel: eventData.privacy_level,
      entityType: eventData.entity_type,
      status: eventData.status,
      location: eventData.entity_metadata?.location,
      image: props.image, // API doesn't return the full image data back
      type: "discord::GuildScheduledEvent",
    } as any as GuildScheduledEvent;
  },
);

/**
 * Type guard for GuildScheduledEvent resource
 */
export function isGuildScheduledEvent(
  resource: unknown,
): resource is GuildScheduledEvent {
  return (resource as any)?.[ResourceKind] === "discord::GuildScheduledEvent";
}
