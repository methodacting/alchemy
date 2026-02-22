import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import {
  type DiscordApplicationCommandOption,
  DiscordApplicationCommandType,
  type DiscordPermissionName,
  DiscordPermissions,
  type DiscordApiApplicationCommand,
} from "./types.ts";

export interface ApplicationCommandProps extends DiscordApiOptions {
  /**
   * The guild to create the command in (if omitted, it's a global command)
   */
  guild?: string | Guild;

  /**
   * Name of the command (1-32 characters)
   * For ChatInput, must be lowercase and match ^[-_\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]{1,32}$
   */
  name: string;

  /**
   * Description of the command (1-100 characters)
   * Empty string for User and Message commands
   */
  description?: string;

  /**
   * Type of the command
   * @default DiscordApplicationCommandType.ChatInput
   */
  commandType?: DiscordApplicationCommandType;

  /**
   * Options for the command (max 25)
   */
  options?: DiscordApplicationCommandOption[];

  /**
   * Default permissions required to use the command
   */
  defaultMemberPermissions?: Partial<Record<DiscordPermissionName, boolean>>;

  /**
   * Whether the command is available in DMs (only for global commands)
   * @deprecated use contexts instead if supported
   */
  dmPermission?: boolean;

  /**
   * Whether the command is age-restricted
   */
  nsfw?: boolean;

  /**
   * Whether to adopt an existing command by name and type
   * @default false
   */
  adopt?: boolean;
}

export type ApplicationCommand = Omit<
  ApplicationCommandProps,
  "token" | "botToken" | "guild" | "defaultMemberPermissions" | "adopt"
> &
  Resource<"discord::ApplicationCommand"> & {
    id: string;
    applicationId: string;
    guildId?: string;
    defaultMemberPermissions?: string;
  };

type ApplicationCommandPropsNormalized = Omit<
  ApplicationCommandProps,
  "guild"
> & {
  guild?: string;
};

export function ApplicationCommand(
  id: string,
  props: ApplicationCommandProps,
): Promise<ApplicationCommand> {
  return _ApplicationCommand(id, {
    ...props,
    guild: props.guild
      ? isGuild(props.guild)
        ? props.guild.id
        : props.guild.toString()
      : undefined,
  });
}

function toBitmask(
  permissions?: Partial<Record<DiscordPermissionName, boolean>>,
): string | undefined {
  if (!permissions) return undefined;
  let bitmask = 0n;
  for (const [name, enabled] of Object.entries(permissions)) {
    if (enabled) {
      const bit = DiscordPermissions[name as DiscordPermissionName];
      if (bit !== undefined) {
        bitmask |= bit;
      }
    }
  }
  return bitmask.toString();
}

/**
 * Manages a Discord Application Command (Global or Guild-specific).
 *
 * @example
 * const ping = await ApplicationCommand("ping", {
 *   guild: guildId,
 *   name: "ping",
 *   description: "Check bot status"
 * });
 */
const _ApplicationCommand = Resource(
  "discord::ApplicationCommand",
  async function (
    this: Context<ApplicationCommand>,
    id: string,
    props: ApplicationCommandPropsNormalized,
  ): Promise<ApplicationCommand> {
    const api = createDiscordApi(props);
    const applicationId = await api.getApplicationId();
    const guildId = props.guild;
    const commandType =
      props.commandType ?? DiscordApplicationCommandType.ChatInput;
    const defaultMemberPermissions = toBitmask(props.defaultMemberPermissions);

    const baseUrl = guildId
      ? `/applications/${applicationId}/guilds/${guildId}/commands`
      : `/applications/${applicationId}/commands`;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`${baseUrl}/${this.output.id}`);
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
      if (
        this.output.guildId !== guildId ||
        this.output.commandType !== commandType
      ) {
        return this.replace(true);
      }
    }

    let commandId = this.output?.id;
    let commandData: DiscordApiApplicationCommand | undefined;

    const body = {
      name: props.name,
      description:
        props.description ??
        (commandType === DiscordApplicationCommandType.ChatInput ? "" : ""),
      options: props.options,
      default_member_permissions: defaultMemberPermissions,
      dm_permission: props.dmPermission,
      type: commandType,
      nsfw: props.nsfw,
    };

    if (this.phase === "create" || !commandId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const commands =
            await api.get<DiscordApiApplicationCommand[]>(baseUrl);
          commandData = commands.find(
            (c) => c.name === props.name && c.type === commandType,
          );
          if (commandData) {
            commandId = commandData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!commandId || this.isReplacement) {
        commandData = await api.post<DiscordApiApplicationCommand>(
          baseUrl,
          body,
        );
        commandId = commandData.id;
      }
    } else {
      // Update existing command
      commandData = await api.patch<DiscordApiApplicationCommand>(
        `${baseUrl}/${commandId}`,
        body,
      );
    }

    if (!commandData) {
      throw new Error(`Failed to find application command ${commandId}`);
    }

    return {
      id: commandData.id,
      applicationId,
      guildId,
      name: commandData.name,
      description: commandData.description,
      commandType: commandData.type as DiscordApplicationCommandType,
      options: commandData.options,
      defaultMemberPermissions:
        commandData.default_member_permissions ?? undefined,
      dmPermission: commandData.dm_permission,
      nsfw: commandData.nsfw,
      type: "discord::ApplicationCommand",
    } as any as ApplicationCommand;
  },
);

/**
 * Type guard for ApplicationCommand resource
 */
export function isApplicationCommand(
  resource: unknown,
): resource is ApplicationCommand {
  return (resource as any)?.[ResourceKind] === "discord::ApplicationCommand";
}
