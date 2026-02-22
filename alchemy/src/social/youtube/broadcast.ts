import { Readable } from "node:stream";
import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export type UploadBody = Blob | ArrayBuffer | Uint8Array | Buffer;

export interface YouTubeBroadcastProps extends YouTubeApiOptions {
  /**
   * Broadcast title
   */
  title: string;

  /**
   * Broadcast description
   */
  description?: string;

  /**
   * Scheduled start time (ISO string)
   */
  scheduledStartTime: string;

  /**
   * Privacy status
   * @default "private"
   */
  privacyStatus?: "private" | "public" | "unlisted";

  /**
   * Optional broadcast ID (for updates)
   */
  broadcastId?: string;

  /**
   * Optional thumbnail binary
   */
  thumbnail?: UploadBody;
}

export type YouTubeBroadcast = Omit<
  YouTubeBroadcastProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::Broadcast"> & {
    /**
     * Broadcast ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::Broadcast";
  };

async function toReadable(body: UploadBody): Promise<Readable> {
  if (body instanceof Readable) {
    return body;
  }

  if (body instanceof Blob) {
    const buffer = Buffer.from(await body.arrayBuffer());
    return Readable.from(buffer);
  }

  if (body instanceof ArrayBuffer) {
    return Readable.from(Buffer.from(body));
  }

  if (body instanceof Uint8Array || Buffer.isBuffer(body)) {
    return Readable.from(Buffer.from(body));
  }

  return Readable.from(body as Buffer);
}

/**
 * Manages a YouTube Live Broadcast.
 */
export const Broadcast = Resource(
  "youtube::Broadcast",
  async function (
    this: Context<YouTubeBroadcast>,
    _id: string,
    props: YouTubeBroadcastProps,
  ): Promise<YouTubeBroadcast> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const broadcastId = props.broadcastId ?? this.output?.id;
      if (broadcastId) {
        const { client } = await createYouTubeClient(props);
        await client.liveBroadcasts.delete({ id: broadcastId });
      }
      return this.destroy();
    }

    const broadcastId = props.broadcastId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: broadcastId,
        broadcastId,
        title: props.title,
        description: props.description,
        scheduledStartTime: props.scheduledStartTime,
        privacyStatus: props.privacyStatus ?? "private",
        thumbnail: props.thumbnail,
        type: "youtube::Broadcast",
      };
    }

    const { client } = await createYouTubeClient(props);

    const snippet: youtube_v3.Schema$LiveBroadcastSnippet = {
      title: props.title,
      description: props.description,
      scheduledStartTime: props.scheduledStartTime,
    };

    const status: youtube_v3.Schema$LiveBroadcastStatus = {
      privacyStatus: props.privacyStatus ?? "private",
    };

    let broadcast: youtube_v3.Schema$LiveBroadcast | undefined;
    const resolvedBroadcastId = props.broadcastId ?? this.output?.id;

    if (this.phase === "create" || !resolvedBroadcastId || this.isReplacement) {
      const createResponse = await client.liveBroadcasts.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet,
          status,
        },
      });
      broadcast = createResponse.data;
    } else {
      const updateResponse = await client.liveBroadcasts.update({
        part: ["snippet", "status"],
        requestBody: {
          id: resolvedBroadcastId,
          snippet,
          status,
        },
      });
      broadcast = updateResponse.data;
    }

    if (!broadcast?.id) {
      throw new Error("Failed to create or update YouTube broadcast");
    }

    if (props.thumbnail) {
      await client.thumbnails.set({
        videoId: broadcast.id,
        media: {
          body: await toReadable(props.thumbnail),
        },
      });
    }

    return {
      id: broadcast.id,
      broadcastId: broadcast.id,
      title: broadcast.snippet?.title ?? props.title,
      description: broadcast.snippet?.description ?? props.description,
      scheduledStartTime:
        broadcast.snippet?.scheduledStartTime ?? props.scheduledStartTime,
      privacyStatus: broadcast.status?.privacyStatus ?? props.privacyStatus,
      thumbnail: props.thumbnail,
      type: "youtube::Broadcast",
    };
  },
);

/**
 * Type guard for YouTubeBroadcast resource.
 */
export function isBroadcast(resource: unknown): resource is YouTubeBroadcast {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::Broadcast"
  );
}
