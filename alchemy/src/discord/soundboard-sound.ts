import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import type { DiscordApiSoundboardSound } from "./types.ts";
import { promises as fs } from "node:fs";
import path from "node:path";

export interface SoundboardSoundProps extends DiscordApiOptions {
  /**
   * The guild to create the sound in
   */
  guild: string | Guild;

  /**
   * Name of the sound (2-32 characters)
   */
  name: string;

  /**
   * Sound data. Provide a data URI, base64 string, Blob, or Uint8Array.
   *
   * Example: "data:audio/ogg;base64,..."
   */
  sound?: string | Blob | Uint8Array;

  /**
   * Path to a sound file to upload (mp3 or ogg)
   */
  soundFilePath?: string;

  /**
   * Content type for raw base64/binary input
   * @default "audio/ogg"
   */
  soundContentType?: string;

  /**
   * Volume from 0 to 1
   * @default 1
   */
  volume?: number;

  /**
   * Custom emoji ID
   */
  emojiId?: string;

  /**
   * Unicode emoji character
   */
  emojiName?: string;

  /**
   * Whether to adopt an existing sound by name
   * @default false
   */
  adopt?: boolean;
}

export type SoundboardSound = Omit<
  SoundboardSoundProps,
  | "token"
  | "botToken"
  | "guild"
  | "sound"
  | "soundFilePath"
  | "soundContentType"
  | "adopt"
> &
  Resource<"discord::SoundboardSound"> & {
    id: string;
    guildId: string;
    available: boolean;
    emojiId?: string | null;
    emojiName?: string | null;
  };

type SoundboardSoundPropsNormalized = Omit<SoundboardSoundProps, "guild"> & {
  guild: string;
};

export function SoundboardSound(
  id: string,
  props: SoundboardSoundProps,
): Promise<SoundboardSound> {
  return _SoundboardSound(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
  });
}

const DEFAULT_SOUND_CONTENT_TYPE = "audio/ogg";

function detectSoundContentType(filePath: string, fallback: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".ogg") return "audio/ogg";
  return fallback;
}

async function toDataUri(
  sound: string | Blob | Uint8Array,
  contentType: string | undefined,
): Promise<string> {
  if (typeof sound === "string") {
    if (sound.startsWith("data:")) {
      return sound;
    }
    const type = contentType ?? DEFAULT_SOUND_CONTENT_TYPE;
    return `data:${type};base64,${sound}`;
  }

  const type = contentType ?? DEFAULT_SOUND_CONTENT_TYPE;
  const bytes =
    sound instanceof Blob ? new Uint8Array(await sound.arrayBuffer()) : sound;
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${type};base64,${base64}`;
}

async function readSoundData(props: SoundboardSoundProps): Promise<string> {
  if (props.soundFilePath) {
    const bytes = new Uint8Array(await fs.readFile(props.soundFilePath));
    const type =
      props.soundContentType ??
      detectSoundContentType(props.soundFilePath, DEFAULT_SOUND_CONTENT_TYPE);
    const base64 = Buffer.from(bytes).toString("base64");
    return `data:${type};base64,${base64}`;
  }
  if (!props.sound) {
    throw new Error("Sound data is required to create a soundboard sound");
  }
  return await toDataUri(props.sound, props.soundContentType);
}

/**
 * Manages a Discord Guild Soundboard Sound.
 */
const _SoundboardSound = Resource(
  "discord::SoundboardSound",
  async function (
    this: Context<SoundboardSound>,
    _id: string,
    props: SoundboardSoundPropsNormalized,
  ): Promise<SoundboardSound> {
    const api = createDiscordApi(props);
    const guildId = props.guild;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(
            `/guilds/${guildId}/soundboard-sounds/${this.output.id}`,
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

    if (this.phase === "update" && this.output) {
      if (props.sound) {
        return this.replace(true);
      }
    }

    let soundId = this.output?.id;
    let soundData: DiscordApiSoundboardSound | undefined;

    if (this.phase === "create" || !soundId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { items } = await api.get<{
            items: DiscordApiSoundboardSound[];
          }>(`/guilds/${guildId}/soundboard-sounds`);
          soundData = items.find((s) => s.name === props.name);
          if (soundData) {
            soundId = soundData.sound_id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!soundId || this.isReplacement) {
        const sound = await readSoundData(props);
        soundData = await api.post<DiscordApiSoundboardSound>(
          `/guilds/${guildId}/soundboard-sounds`,
          {
            name: props.name,
            sound,
            volume: props.volume ?? 1,
            emoji_id: props.emojiId,
            emoji_name: props.emojiName,
          },
        );
        soundId = soundData.sound_id;
      }
    } else {
      if (
        props.name !== this.output.name ||
        props.volume !== this.output.volume ||
        props.emojiId !== this.output.emojiId ||
        props.emojiName !== this.output.emojiName
      ) {
        soundData = await api.patch<DiscordApiSoundboardSound>(
          `/guilds/${guildId}/soundboard-sounds/${soundId}`,
          {
            name: props.name,
            volume: props.volume ?? this.output.volume,
            emoji_id: props.emojiId,
            emoji_name: props.emojiName,
          },
        );
      } else {
        soundData = await api.get<DiscordApiSoundboardSound>(
          `/guilds/${guildId}/soundboard-sounds/${soundId}`,
        );
      }
    }

    if (!soundData) {
      throw new Error(`Failed to find soundboard sound ${soundId}`);
    }

    return {
      id: soundData.sound_id,
      guildId,
      name: soundData.name,
      volume: soundData.volume,
      emojiId: soundData.emoji_id ?? undefined,
      emojiName: soundData.emoji_name ?? undefined,
      available: soundData.available ?? true,
      type: "discord::SoundboardSound",
    } as SoundboardSound;
  },
);

/**
 * Type guard for SoundboardSound resource
 */
export function isSoundboardSound(
  resource: unknown,
): resource is SoundboardSound {
  return (resource as any)?.[ResourceKind] === "discord::SoundboardSound";
}
