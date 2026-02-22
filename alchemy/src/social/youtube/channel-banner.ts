import { Readable } from "node:stream";
import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createYouTubeClient, type YouTubeApiOptions } from "./client.ts";

export type UploadBody = Blob | ArrayBuffer | Uint8Array | Buffer;

export interface YouTubeChannelBannerProps extends YouTubeApiOptions {
  /**
   * Channel ID (optional; defaults to authenticated channel)
   */
  channelId?: string;

  /**
   * Banner image binary
   */
  banner: UploadBody;

  /**
   * Optional channel banner targeting configuration
   */
  targetChannelId?: string;
}

export type YouTubeChannelBanner = Omit<
  YouTubeChannelBannerProps,
  "clientId" | "clientSecret" | "refreshToken"
> &
  Resource<"youtube::ChannelBanner"> & {
    /**
     * Channel ID.
     */
    id: string;

    /**
     * Banner URL returned by YouTube.
     */
    bannerUrl?: string;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "youtube::ChannelBanner";
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
 * Uploads a YouTube channel banner.
 */
export const ChannelBanner = Resource(
  "youtube::ChannelBanner",
  async function (
    this: Context<YouTubeChannelBanner>,
    _id: string,
    props: YouTubeChannelBannerProps,
  ): Promise<YouTubeChannelBanner> {
    if (this.phase === "delete") {
      return this.destroy();
    }

    const resolvedChannelId = props.channelId ?? this.output?.id ?? "local";

    if (this.scope.local) {
      return {
        id: resolvedChannelId,
        channelId: resolvedChannelId,
        banner: props.banner,
        targetChannelId: props.targetChannelId,
        bannerUrl: undefined,
        type: "youtube::ChannelBanner",
      };
    }

    const { client } = await createYouTubeClient(props);

    const response = await client.channelBanners.insert({
      ...(props.targetChannelId ? { channelId: props.targetChannelId } : {}),
      media: {
        body: await toReadable(props.banner),
      },
    });

    return {
      id: resolvedChannelId,
      channelId: resolvedChannelId,
      banner: props.banner,
      targetChannelId: props.targetChannelId,
      bannerUrl: response.data.url ?? undefined,
      type: "youtube::ChannelBanner",
    };
  },
);

/**
 * Type guard for YouTubeChannelBanner resource.
 */
export function isChannelBanner(
  resource: unknown,
): resource is YouTubeChannelBanner {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "youtube::ChannelBanner"
  );
}
