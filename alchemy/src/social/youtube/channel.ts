import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export interface YouTubeChannelProps extends YouTubeApiOptions {
  /**
   * Channel ID (optional; defaults to the authenticated channel)
   */
  channelId?: string;

  /**
   * Channel description
   */
  description?: string;

  /**
   * Channel keywords (space-separated string)
   */
  keywords?: string;

  /**
   * Channel country code
   */
  country?: string;

  /**
   * Branding settings override
   */
  brandingSettings?: youtube_v3.Schema$ChannelBrandingSettings;
}

export type YouTubeChannel = Omit<
  YouTubeChannelProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::Channel"> & {
    /**
     * Channel ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::Channel";
  };

function mergeBrandingSettings(
  current: youtube_v3.Schema$ChannelBrandingSettings | undefined,
  incoming: youtube_v3.Schema$ChannelBrandingSettings | undefined,
  keywords: string | undefined,
): youtube_v3.Schema$ChannelBrandingSettings | undefined {
  if (!current && !incoming && !keywords) {
    return undefined;
  }

  const mergedChannel = {
    ...(current?.channel ?? {}),
    ...(incoming?.channel ?? {}),
    ...(keywords !== undefined ? { keywords } : {}),
  };

  return {
    ...(current ?? {}),
    ...(incoming ?? {}),
    channel: mergedChannel,
  };
}

/**
 * Manages a YouTube Channel's branding settings.
 */
export const Channel = Resource(
  "youtube::Channel",
  async function (
    this: Context<YouTubeChannel>,
    _id: string,
    props: YouTubeChannelProps,
  ): Promise<YouTubeChannel> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const resolvedChannelId = props.channelId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: resolvedChannelId,
        channelId: resolvedChannelId,
        description: props.description,
        keywords: props.keywords,
        country: props.country,
        brandingSettings: props.brandingSettings,
        type: "youtube::Channel",
      };
    }

    const { client } = await createYouTubeClient(props);

    const channelResponse = await client.channels.list({
      part: ["snippet", "brandingSettings"],
      ...(props.channelId ? { id: [props.channelId] } : { mine: true }),
    });

    const currentChannel = channelResponse.data.items?.[0];
    if (!currentChannel?.id) {
      throw new Error("Unable to resolve YouTube channel");
    }

    const snippet = {
      ...(currentChannel.snippet ?? {}),
      ...(props.description !== undefined
        ? { description: props.description }
        : {}),
      ...(props.country !== undefined ? { country: props.country } : {}),
    } as youtube_v3.Schema$ChannelSnippet;

    const brandingSettings = mergeBrandingSettings(
      currentChannel.brandingSettings,
      props.brandingSettings,
      props.keywords,
    );

    const updateResponse = await client.channels.update({
      part: ["snippet", "brandingSettings"],
      requestBody: {
        id: currentChannel.id,
        snippet,
        brandingSettings,
      },
    });

    const updated = updateResponse.data;

    return {
      id: updated.id ?? currentChannel.id,
      channelId: updated.id ?? currentChannel.id,
      description:
        updated.snippet?.description ??
        props.description ??
        snippet.description,
      keywords:
        updated.brandingSettings?.channel?.keywords ??
        props.keywords ??
        brandingSettings?.channel?.keywords,
      country: updated.snippet?.country ?? props.country ?? snippet.country,
      brandingSettings: updated.brandingSettings ?? brandingSettings,
      type: "youtube::Channel",
    };
  },
);

/**
 * Type guard for YouTubeChannel resource.
 */
export function isChannel(resource: unknown): resource is YouTubeChannel {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::Channel"
  );
}
