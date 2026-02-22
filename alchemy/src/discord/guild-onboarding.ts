import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isChannel, type Channel } from "./channel.ts";
import { isGuild, type Guild } from "./guild.ts";
import { isRole, type Role } from "./role.ts";
import {
  type DiscordApiGuildOnboarding,
  type DiscordApiOnboardingOption,
  type DiscordApiOnboardingPrompt,
  DiscordOnboardingMode,
  DiscordOnboardingPromptType,
} from "./types.ts";

export interface OnboardingOption {
  /**
   * Title of the option
   */
  title: string;

  /**
   * Description of the option
   */
  description?: string;

  /**
   * Channels to assign when this option is selected
   */
  channels?: Array<string | Channel>;

  /**
   * Roles to assign when this option is selected
   */
  roles?: Array<string | Role>;

  /**
   * Emoji for the option (id, name, or unicode)
   * Note: For custom emojis, you need the ID.
   */
  emoji?: {
    id?: string;
    name?: string;
    animated?: boolean;
  };
}

interface OnboardingOptionNormalized extends Omit<
  OnboardingOption,
  "channels" | "roles"
> {
  channels?: string[];
  roles?: string[];
}

export interface OnboardingPrompt {
  /**
   * Title of the prompt
   */
  title: string;

  /**
   * Options available in the prompt
   */
  options: OnboardingOption[];

  /**
   * Type of the prompt
   * @default DiscordOnboardingPromptType.MultipleChoice
   */
  type?: DiscordOnboardingPromptType;

  /**
   * Whether the user can only select one option
   * @default false
   */
  singleSelect?: boolean;

  /**
   * Whether the prompt is required
   * @default false
   */
  required?: boolean;

  /**
   * Whether the prompt is shown during onboarding (otherwise just in Channels & Roles)
   * @default true
   */
  inOnboarding?: boolean;
}

interface OnboardingPromptNormalized extends Omit<OnboardingPrompt, "options"> {
  options: OnboardingOptionNormalized[];
}

export interface GuildOnboardingProps extends DiscordApiOptions {
  /**
   * The guild to configure onboarding for
   */
  guild: string | Guild;

  /**
   * Prompts for the onboarding flow
   */
  prompts: OnboardingPrompt[];

  /**
   * Default channels that all users are added to
   */
  defaultChannels: Array<string | Channel>;

  /**
   * Whether onboarding is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Onboarding mode
   * @default DiscordOnboardingMode.Default
   */
  mode?: DiscordOnboardingMode;
}

export type GuildOnboarding = Omit<
  GuildOnboardingProps,
  "token" | "botToken" | "guild" | "prompts" | "defaultChannels"
> &
  Resource<"discord::GuildOnboarding"> & {
    id: string; // guildId
    guildId: string;
    type: "discord::GuildOnboarding";
  };

type GuildOnboardingPropsNormalized = Omit<
  GuildOnboardingProps,
  "guild" | "prompts" | "defaultChannels"
> & {
  guild: string;
  prompts: OnboardingPromptNormalized[];
  defaultChannels: string[];
};

export function GuildOnboarding(
  id: string,
  props: GuildOnboardingProps,
): Promise<GuildOnboarding> {
  const prompts = props.prompts.map((prompt) => ({
    ...prompt,
    options: prompt.options.map((option) => ({
      ...option,
      channels: option.channels?.map((channel) =>
        isChannel(channel) ? channel.id : channel.toString(),
      ),
      roles: option.roles?.map((role) =>
        isRole(role) ? role.id : role.toString(),
      ),
    })),
  }));

  return _GuildOnboarding(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
    defaultChannels: props.defaultChannels.map((channel) =>
      isChannel(channel) ? channel.id : channel.toString(),
    ),
    prompts,
  });
}

/**
 * Manages Discord Guild Onboarding configuration.
 *
 * @example
 * await GuildOnboarding("setup", {
 *   guild: guildId,
 *   defaultChannels: [generalChannel],
 *   prompts: [{
 *     title: "Pick your role",
 *     options: [{
 *       title: "Developer",
 *       roles: [devRole],
 *       channels: [devChannel]
 *     }]
 *   }]
 * });
 */
const _GuildOnboarding = Resource(
  "discord::GuildOnboarding",
  async function (
    this: Context<GuildOnboarding>,
    _id: string,
    props: GuildOnboardingPropsNormalized,
  ): Promise<GuildOnboarding> {
    const api = createDiscordApi(props);
    const guildId = props.guild;

    // Map default channels
    const defaultChannelIds = props.defaultChannels;

    // Map prompts and options
    // Note: To update prompts, we must map them to the API structure.
    // However, existing prompts have IDs. New ones don't.
    // The simplified strategy for IaC is to treat the defined prompts as the "source of truth".
    // Discord API is tricky here: PUT /onboarding requires us to send ALL prompts.
    // If we want to preserve IDs of existing prompts (to keep user selections), we would need to fetch first and match by title.

    // 1. Fetch existing to match IDs if possible
    let existingOnboarding: DiscordApiGuildOnboarding | undefined;
    try {
      existingOnboarding = await api.get<DiscordApiGuildOnboarding>(
        `/guilds/${guildId}/onboarding`,
      );
    } catch (e) {
      /* ignore */
    }

    const DISCORD_EPOCH = 1420070400000n;
    let increment = 0n;
    const generateSnowflake = (): string => {
      const timestamp = BigInt(Date.now()) - DISCORD_EPOCH;
      increment = (increment + 1n) & 0xfffn; // 12-bit increment
      const snowflake = (timestamp << 22n) | increment;
      return snowflake.toString();
    };

    const prompts = props.prompts.map(
      (p, promptIndex): Partial<DiscordApiOnboardingPrompt> => {
        // Try to find existing prompt ID by title to preserve it
        const existingPrompt =
          existingOnboarding?.prompts.find((ep) => ep.title === p.title) ??
          existingOnboarding?.prompts[promptIndex];

        const options = p.options.map(
          (o, optionIndex): Partial<DiscordApiOnboardingOption> => {
            const existingOption =
              existingPrompt?.options.find((eo) => eo.title === o.title) ??
              existingPrompt?.options[optionIndex];
            // Map to flat emoji fields for API
            const emojiFields: Record<string, string | boolean | undefined> =
              {};
            if (o.emoji) {
              emojiFields.emoji_id = o.emoji.id;
              emojiFields.emoji_name = o.emoji.name;
              emojiFields.emoji_animated = o.emoji.animated;
            }

            return {
              id: existingOption?.id ?? generateSnowflake(),
              title: o.title,
              description: o.description,
              ...emojiFields,
              channel_ids: o.channels ?? [],
              role_ids: o.roles ?? [],
            };
          },
        );

        return {
          id: existingPrompt?.id ?? generateSnowflake(),
          title: p.title,
          type: p.type ?? DiscordOnboardingPromptType.MultipleChoice,
          options: options as DiscordApiOnboardingOption[],
          single_select: p.singleSelect ?? false,
          required: p.required ?? false,
          in_onboarding: p.inOnboarding ?? true,
        };
      },
    );

    const body = {
      prompts,
      default_channel_ids: defaultChannelIds,
      enabled: props.enabled ?? true,
      mode: props.mode ?? DiscordOnboardingMode.Default,
    };

    // Ensure IDs are present for all prompts/options (Discord requires them)
    for (const p of body.prompts) {
      if (!("id" in p) || !p.id) {
        throw new Error("Onboarding prompt id generation failed.");
      }
      for (const o of p.options ?? []) {
        if (!("id" in o) || !o.id) {
          throw new Error("Onboarding option id generation failed.");
        }
      }
    }

    console.log("ONBOARDING PAYLOAD:", JSON.stringify(body, null, 2));

    if (this.phase === "delete") {
      // "Delete" just disables it
      if (this.output?.guildId) {
        try {
          await api.put(`/guilds/${this.output.guildId}/onboarding`, {
            ...body,
            enabled: false,
          });
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("404")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    // Create or Update is the same PUT
    let result: DiscordApiGuildOnboarding;
    try {
      result = await api.put<DiscordApiGuildOnboarding>(
        `/guilds/${guildId}/onboarding`,
        body,
      );
    } catch (error: unknown) {
      const message = (error as Error).message;
      if (body.enabled && message?.includes("requirements are not met")) {
        // Fallback: create onboarding in disabled state so the flow is still scaffolded
        const disabledBody = { ...body, enabled: false };
        result = await api.put<DiscordApiGuildOnboarding>(
          `/guilds/${guildId}/onboarding`,
          disabledBody,
        );
      } else {
        throw error;
      }
    }

    return {
      id: guildId,
      guildId,
      enabled: result.enabled,
      mode: result.mode,
      type: "discord::GuildOnboarding",
    } as any as GuildOnboarding;
  },
);

/**
 * Type guard for GuildOnboarding resource
 */
export function isGuildOnboarding(
  resource: unknown,
): resource is GuildOnboarding {
  return (resource as any)?.[ResourceKind] === "discord::GuildOnboarding";
}
