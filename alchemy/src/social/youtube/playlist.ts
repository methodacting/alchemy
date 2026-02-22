import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export interface YouTubePlaylistProps extends YouTubeApiOptions {
  /**
   * Playlist ID (required for updates/deletes)
   */
  playlistId?: string;

  /**
   * Playlist title
   */
  title: string;

  /**
   * Playlist description
   */
  description?: string;

  /**
   * Playlist tags
   */
  tags?: string[];

  /**
   * Privacy status
   * @default "private"
   */
  privacyStatus?: "private" | "public" | "unlisted";
}

export type YouTubePlaylist = Omit<
  YouTubePlaylistProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::Playlist"> & {
    /**
     * Playlist ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::Playlist";
  };

/**
 * Manages YouTube playlists.
 */
export const Playlist = Resource(
  "youtube::Playlist",
  async function (
    this: Context<YouTubePlaylist>,
    _id: string,
    props: YouTubePlaylistProps,
  ): Promise<YouTubePlaylist> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const playlistId = props.playlistId ?? this.output?.id;
      if (playlistId) {
        const { client } = await createYouTubeClient(props);
        await client.playlists.delete({ id: playlistId });
      }
      return this.destroy();
    }

    const resolvedPlaylistId = props.playlistId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: resolvedPlaylistId,
        playlistId: resolvedPlaylistId,
        title: props.title,
        description: props.description,
        tags: props.tags,
        privacyStatus: props.privacyStatus ?? "private",
        type: "youtube::Playlist",
      };
    }

    const { client } = await createYouTubeClient(props);

    const snippet: youtube_v3.Schema$PlaylistSnippet = {
      title: props.title,
      description: props.description,
      tags: props.tags,
    };

    const status: youtube_v3.Schema$PlaylistStatus = {
      privacyStatus: props.privacyStatus ?? "private",
    };

    let playlist: youtube_v3.Schema$Playlist | undefined;

    if (this.phase === "create" || !props.playlistId || this.isReplacement) {
      const createResponse = await client.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet,
          status,
        },
      });
      playlist = createResponse.data;
    } else {
      const updateResponse = await client.playlists.update({
        part: ["snippet", "status"],
        requestBody: {
          id: props.playlistId,
          snippet,
          status,
        },
      });
      playlist = updateResponse.data;
    }

    if (!playlist?.id) {
      throw new Error("Failed to create or update playlist");
    }

    return {
      id: playlist.id,
      playlistId: playlist.id,
      title: playlist.snippet?.title ?? props.title,
      description: playlist.snippet?.description ?? props.description,
      tags: playlist.snippet?.tags ?? props.tags,
      privacyStatus: playlist.status?.privacyStatus ?? props.privacyStatus,
      type: "youtube::Playlist",
    };
  },
);

/**
 * Type guard for YouTubePlaylist resource.
 */
export function isPlaylist(resource: unknown): resource is YouTubePlaylist {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::Playlist"
  );
}
