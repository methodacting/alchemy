import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export interface YouTubePlaylistItemProps extends YouTubeApiOptions {
  /**
   * Playlist ID
   */
  playlistId: string;

  /**
   * Video ID
   */
  videoId: string;

  /**
   * Playlist item ID (required for updates/deletes)
   */
  itemId?: string;

  /**
   * Position in the playlist
   */
  position?: number;
}

export type YouTubePlaylistItem = Omit<
  YouTubePlaylistItemProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::PlaylistItem"> & {
    /**
     * Playlist item ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::PlaylistItem";
  };

/**
 * Manages YouTube playlist items.
 */
export const PlaylistItem = Resource(
  "youtube::PlaylistItem",
  async function (
    this: Context<YouTubePlaylistItem>,
    _id: string,
    props: YouTubePlaylistItemProps,
  ): Promise<YouTubePlaylistItem> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const itemId = props.itemId ?? this.output?.id;
      if (itemId) {
        const { client } = await createYouTubeClient(props);
        await client.playlistItems.delete({ id: itemId });
      }
      return this.destroy();
    }

    const resolvedItemId = props.itemId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: resolvedItemId,
        itemId: resolvedItemId,
        playlistId: props.playlistId,
        videoId: props.videoId,
        position: props.position,
        type: "youtube::PlaylistItem",
      };
    }

    const { client } = await createYouTubeClient(props);

    const snippet: youtube_v3.Schema$PlaylistItemSnippet = {
      playlistId: props.playlistId,
      position: props.position,
      resourceId: {
        kind: "youtube#video",
        videoId: props.videoId,
      },
    };

    let item: youtube_v3.Schema$PlaylistItem | undefined;

    if (this.phase === "create" || !props.itemId || this.isReplacement) {
      const createResponse = await client.playlistItems.insert({
        part: ["snippet"],
        requestBody: {
          snippet,
        },
      });
      item = createResponse.data;
    } else {
      const updateResponse = await client.playlistItems.update({
        part: ["snippet"],
        requestBody: {
          id: props.itemId,
          snippet,
        },
      });
      item = updateResponse.data;
    }

    if (!item?.id) {
      throw new Error("Failed to create or update playlist item");
    }

    return {
      id: item.id,
      itemId: item.id,
      playlistId: item.snippet?.playlistId ?? props.playlistId,
      videoId: item.snippet?.resourceId?.videoId ?? props.videoId,
      position: item.snippet?.position ?? props.position,
      type: "youtube::PlaylistItem",
    };
  },
);

/**
 * Type guard for YouTubePlaylistItem resource.
 */
export function isPlaylistItem(
  resource: unknown,
): resource is YouTubePlaylistItem {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::PlaylistItem"
  );
}
