import { Readable } from "node:stream";
import type { youtube_v3 } from "googleapis";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export type UploadBody = Blob | ArrayBuffer | Uint8Array | Buffer;

export interface YouTubeVideoProps extends YouTubeApiOptions {
  /**
   * Video ID
   */
  videoId: string;

  /**
   * Video title
   */
  title?: string;

  /**
   * Video description
   */
  description?: string;

  /**
   * Video tags
   */
  tags?: string[];

  /**
   * Video category ID
   */
  categoryId?: string;

  /**
   * Optional thumbnail binary
   */
  thumbnail?: UploadBody;
}

export type YouTubeVideo = Omit<
  YouTubeVideoProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::Video"> & {
    /**
     * Video ID.
     */
    id: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::Video";
  };

/**
 * Manages YouTube video metadata.
 */
export const Video = Resource(
  "youtube::Video",
  async function (
    this: Context<YouTubeVideo>,
    _id: string,
    props: YouTubeVideoProps,
  ): Promise<YouTubeVideo> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    if (this.scope.local) {
      return {
        id: props.videoId,
        videoId: props.videoId,
        title: props.title,
        description: props.description,
        tags: props.tags,
        categoryId: props.categoryId,
        thumbnail: props.thumbnail,
        type: "youtube::Video",
      };
    }

    const { client } = await createYouTubeClient(props);

    const videoResponse = await client.videos.list({
      part: ["snippet"],
      id: [props.videoId],
    });

    const currentVideo = videoResponse.data.items?.[0];
    if (!currentVideo?.id) {
      throw new Error(`Video not found: ${props.videoId}`);
    }

    const snippet = {
      ...(currentVideo.snippet ?? {}),
      ...(props.title !== undefined ? { title: props.title } : {}),
      ...(props.description !== undefined
        ? { description: props.description }
        : {}),
      ...(props.tags !== undefined ? { tags: props.tags } : {}),
      ...(props.categoryId !== undefined
        ? { categoryId: props.categoryId }
        : {}),
    } as youtube_v3.Schema$VideoSnippet;

    const updateResponse = await client.videos.update({
      part: ["snippet"],
      requestBody: {
        id: props.videoId,
        snippet,
      },
    });

    const updated = updateResponse.data;

    if (props.thumbnail) {
      await client.thumbnails.set({
        videoId: props.videoId,
        media: {
          body: await toReadable(props.thumbnail),
        },
      });
    }

    return {
      id: updated.id ?? props.videoId,
      videoId: updated.id ?? props.videoId,
      title: updated.snippet?.title ?? props.title ?? snippet.title,
      description:
        updated.snippet?.description ??
        props.description ??
        snippet.description,
      tags: updated.snippet?.tags ?? props.tags ?? snippet.tags,
      categoryId:
        updated.snippet?.categoryId ?? props.categoryId ?? snippet.categoryId,
      thumbnail: props.thumbnail,
      type: "youtube::Video",
    };
  },
);

/**
 * Type guard for YouTubeVideo resource.
 */
export function isVideo(resource: unknown): resource is YouTubeVideo {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] === "youtube::Video"
  );
}

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
