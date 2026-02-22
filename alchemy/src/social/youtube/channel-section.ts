import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export interface YouTubeChannelSectionProps extends YouTubeApiOptions {
  /**
   * Channel ID (optional; defaults to authenticated channel)
   */
  channelId?: string;

  /**
   * Section ID (required for updates/deletes)
   */
  sectionId?: string;

  /**
   * Section type (e.g. singlePlaylist, multiplePlaylists, popularUploads)
   */
  sectionType: string;

  /**
   * Section style (optional)
   */
  style?: string;

  /**
   * Position of the section
   */
  position?: number;

  /**
   * Playlist IDs for the section
   */
  playlists?: string[];

  /**
   * Channel IDs for the section
   */
  channels?: string[];
}

export type YouTubeChannelSection = Omit<
  YouTubeChannelSectionProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::ChannelSection"> & {
    /**
     * Section ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::ChannelSection";
  };

/**
 * Manages YouTube channel sections.
 */
export const ChannelSection = Resource(
  "youtube::ChannelSection",
  async function (
    this: Context<YouTubeChannelSection>,
    _id: string,
    props: YouTubeChannelSectionProps,
  ): Promise<YouTubeChannelSection> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const sectionId = props.sectionId ?? this.output?.id;
      if (sectionId) {
        const { client } = await createYouTubeClient(props);
        await client.channelSections.delete({ id: sectionId });
      }
      return this.destroy();
    }

    const resolvedSectionId = props.sectionId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: resolvedSectionId,
        channelId: props.channelId ?? resolvedSectionId,
        sectionId: resolvedSectionId,
        sectionType: props.sectionType,
        style: props.style,
        position: props.position,
        playlists: props.playlists,
        channels: props.channels,
        type: "youtube::ChannelSection",
      };
    }

    const { client } = await createYouTubeClient(props);

    const snippet: youtube_v3.Schema$ChannelSectionSnippet = {
      type: props.sectionType,
      style: props.style,
      position: props.position,
      channelId: props.channelId,
    };

    const contentDetails: youtube_v3.Schema$ChannelSectionContentDetails = {
      playlists: props.playlists,
      channels: props.channels,
    };

    let section: youtube_v3.Schema$ChannelSection | undefined;

    if (this.phase === "create" || !props.sectionId || this.isReplacement) {
      const createResponse = await client.channelSections.insert({
        part: ["snippet", "contentDetails"],
        requestBody: {
          snippet,
          contentDetails,
        },
      });
      section = createResponse.data;
    } else {
      const updateResponse = await client.channelSections.update({
        part: ["snippet", "contentDetails"],
        requestBody: {
          id: props.sectionId,
          snippet,
          contentDetails,
        },
      });
      section = updateResponse.data;
    }

    if (!section?.id) {
      throw new Error("Failed to create or update channel section");
    }

    return {
      id: section.id,
      channelId: section.snippet?.channelId ?? props.channelId,
      sectionId: section.id,
      sectionType: section.snippet?.type ?? props.sectionType,
      style: section.snippet?.style ?? props.style,
      position: section.snippet?.position ?? props.position,
      playlists: section.contentDetails?.playlists ?? props.playlists,
      channels: section.contentDetails?.channels ?? props.channels,
      type: "youtube::ChannelSection",
    };
  },
);

/**
 * Type guard for YouTubeChannelSection resource.
 */
export function isChannelSection(
  resource: unknown,
): resource is YouTubeChannelSection {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::ChannelSection"
  );
}
