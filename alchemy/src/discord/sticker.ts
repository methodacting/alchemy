import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import type {
  DiscordApiSticker,
  DiscordStickerFormatType,
  DiscordStickerType,
} from "./types.ts";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface StickerProps extends DiscordApiOptions {
  /**
   * The guild to create the sticker in
   */
  guild: string | Guild;

  /**
   * Sticker name (2-30 characters)
   */
  name: string;

  /**
   * Sticker description (2-100 characters)
   */
  description?: string;

  /**
   * Tags (max 200 characters)
   */
  tags: string;

  /**
   * Sticker file content: data URI, base64 string, Blob, or Uint8Array
   */
  file?: string | Blob | Uint8Array;

  /**
   * Path to a sticker file to upload
   */
  filePath?: string;

  /**
   * Content type for raw base64/binary input
   * @default "image/png"
   */
  fileContentType?: string;

  /**
   * File name for the sticker upload
   * @default "sticker.png"
   */
  fileName?: string;

  /**
   * Whether to adopt an existing sticker by name
   * @default false
   */
  adopt?: boolean;
}

export type Sticker = Omit<
  StickerProps,
  | "token"
  | "botToken"
  | "guild"
  | "file"
  | "filePath"
  | "fileContentType"
  | "fileName"
  | "adopt"
> &
  Resource<"discord::Sticker"> & {
    id: string;
    guildId: string;
    type: DiscordStickerType;
    formatType: DiscordStickerFormatType;
    available?: boolean;
  };

type StickerPropsNormalized = Omit<StickerProps, "guild"> & {
  guild: string;
};

export function Sticker(id: string, props: StickerProps): Promise<Sticker> {
  return _Sticker(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
  });
}

const DEFAULT_STICKER_CONTENT_TYPE = "image/png";

function detectStickerContentType(filePath: string, fallback: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".apng") return "image/apng";
  if (ext === ".gif") return "image/gif";
  if (ext === ".json") return "application/json";
  return fallback;
}

function parseDataUri(dataUri: string): {
  contentType: string;
  base64: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
  if (!match) {
    throw new Error("Invalid data URI for sticker file");
  }
  return { contentType: match[1], base64: match[2] };
}

async function toStickerFile(
  file: string | Blob | Uint8Array,
  contentType: string | undefined,
): Promise<{ contentType: string; bytes: Uint8Array }> {
  if (typeof file === "string") {
    if (file.startsWith("data:")) {
      const parsed = parseDataUri(file);
      return {
        contentType: parsed.contentType,
        bytes: Uint8Array.from(Buffer.from(parsed.base64, "base64")),
      };
    }
    const type = contentType ?? DEFAULT_STICKER_CONTENT_TYPE;
    return {
      contentType: type,
      bytes: Uint8Array.from(Buffer.from(file, "base64")),
    };
  }

  const type = contentType ?? DEFAULT_STICKER_CONTENT_TYPE;
  const bytes =
    file instanceof Blob ? new Uint8Array(await file.arrayBuffer()) : file;
  return { contentType: type, bytes };
}

async function readStickerFile(
  props: StickerProps,
): Promise<{ contentType: string; bytes: Uint8Array; fileName: string }> {
  if (props.filePath) {
    const bytes = new Uint8Array(await fs.readFile(props.filePath));
    const contentType =
      props.fileContentType ??
      detectStickerContentType(props.filePath, DEFAULT_STICKER_CONTENT_TYPE);
    return {
      contentType,
      bytes,
      fileName: props.fileName ?? path.basename(props.filePath),
    };
  }
  if (!props.file) {
    throw new Error("Sticker file is required to create a sticker");
  }
  const result = await toStickerFile(props.file, props.fileContentType);
  return { ...result, fileName: props.fileName ?? "sticker.png" };
}

/**
 * Manages a Discord Guild Sticker.
 */
const _Sticker = Resource(
  "discord::Sticker",
  async function (
    this: Context<Sticker>,
    _id: string,
    props: StickerPropsNormalized,
  ): Promise<Sticker> {
    const api = createDiscordApi(props);
    const guildId = props.guild;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/guilds/${guildId}/stickers/${this.output.id}`);
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (props.file || props.filePath) {
        return this.replace(true);
      }
    }

    let stickerId = this.output?.id;
    let stickerData: DiscordApiSticker | undefined;

    if (this.phase === "create" || !stickerId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const stickers = await api.get<DiscordApiSticker[]>(
            `/guilds/${guildId}/stickers`,
          );
          stickerData = stickers.find((s) => s.name === props.name);
          if (stickerData) {
            stickerId = stickerData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!stickerId || this.isReplacement) {
        const { contentType, bytes, fileName } = await readStickerFile(props);
        const form = new FormData();
        form.set("name", props.name);
        form.set("description", props.description ?? "");
        form.set("tags", props.tags);
        form.set("file", new Blob([bytes], { type: contentType }), fileName);

        stickerData = await api.postForm<DiscordApiSticker>(
          `/guilds/${guildId}/stickers`,
          form,
        );
        stickerId = stickerData.id;
      }
    } else {
      if (
        props.name !== this.output.name ||
        props.description !== this.output.description ||
        props.tags !== this.output.tags
      ) {
        stickerData = await api.patch<DiscordApiSticker>(
          `/guilds/${guildId}/stickers/${stickerId}`,
          {
            name: props.name,
            description: props.description,
            tags: props.tags,
          },
        );
      } else {
        stickerData = await api.get<DiscordApiSticker>(
          `/guilds/${guildId}/stickers/${stickerId}`,
        );
      }
    }

    if (!stickerData) {
      throw new Error(`Failed to find sticker ${stickerId}`);
    }

    return {
      id: stickerData.id,
      guildId,
      name: stickerData.name,
      description: stickerData.description ?? undefined,
      tags: stickerData.tags,
      type: stickerData.type as DiscordStickerType,
      formatType: stickerData.format_type as DiscordStickerFormatType,
      available: stickerData.available ?? undefined,
      type: "discord::Sticker",
    } as Sticker;
  },
);

/**
 * Type guard for Sticker resource
 */
export function isSticker(resource: unknown): resource is Sticker {
  return (resource as any)?.[ResourceKind] === "discord::Sticker";
}
