import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDiscordApi, type DiscordApiOptions } from "./api.ts";
import { isGuild, type Guild } from "./guild.ts";
import { isChannel, type Channel } from "./channel.ts";
import { isRole, type Role } from "./role.ts";
import {
  type DiscordAutoModerationEventType,
  type DiscordAutoModerationTriggerType,
  type DiscordAutoModerationTriggerMetadata,
  type DiscordAutoModerationAction,
  type DiscordApiAutoModerationRule,
} from "./types.ts";

export interface AutoModerationRuleProps extends DiscordApiOptions {
  /**
   * The guild to create the rule in
   */
  guild: string | Guild;

  /**
   * The rule name
   */
  name: string;

  /**
   * The event context in which the rule should be checked
   */
  eventType: DiscordAutoModerationEventType;

  /**
   * The type of content which can trigger the rule
   */
  triggerType: DiscordAutoModerationTriggerType;

  /**
   * Additional data used to determine whether a rule should be triggered
   */
  triggerMetadata?: DiscordAutoModerationTriggerMetadata;

  /**
   * The actions which will execute when the rule is triggered
   */
  actions: DiscordAutoModerationAction[];

  /**
   * Whether the rule is enabled
   * @default false
   */
  enabled?: boolean;

  /**
   * The roles that should not be affected by the rule
   */
  exemptRoles?: Array<string | Role>;

  /**
   * The channels that should not be affected by the rule
   */
  exemptChannels?: Array<string | Channel>;

  /**
   * Whether to adopt an existing rule by name
   * @default false
   */
  adopt?: boolean;
}

export type AutoModerationRule = Omit<
  AutoModerationRuleProps,
  "token" | "botToken" | "guild" | "exemptRoles" | "exemptChannels" | "adopt"
> &
  Resource<"discord::AutoModerationRule"> & {
    id: string;
    guildId: string;
    exemptRoleIds: string[];
    exemptChannelIds: string[];
  };

type AutoModerationRulePropsNormalized = Omit<
  AutoModerationRuleProps,
  "guild" | "exemptRoles" | "exemptChannels"
> & {
  guild: string;
  exemptRoles?: string[];
  exemptChannels?: string[];
};

export function AutoModerationRule(
  id: string,
  props: AutoModerationRuleProps,
): Promise<AutoModerationRule> {
  return _AutoModerationRule(id, {
    ...props,
    guild: isGuild(props.guild) ? props.guild.id : props.guild.toString(),
    exemptRoles: props.exemptRoles?.map((role) =>
      isRole(role) ? role.id : role.toString(),
    ),
    exemptChannels: props.exemptChannels?.map((channel) =>
      isChannel(channel) ? channel.id : channel.toString(),
    ),
  });
}

/**
 * Manages a Discord Auto Moderation Rule.
 *
 * @example
 * await AutoModerationRule("block-invites", {
 *   guild: guildId,
 *   name: "Block Invite Links",
 *   eventType: DiscordAutoModerationEventType.MessageSend,
 *   triggerType: DiscordAutoModerationTriggerType.Keyword,
 *   triggerMetadata: {
 *     keyword_filter: ["discord.gg/*", "discord.com/invite/*"]
 *   },
 *   actions: [
 *     { type: DiscordAutoModerationActionType.BlockMessage }
 *   ],
 *   enabled: true
 * });
 */
const _AutoModerationRule = Resource(
  "discord::AutoModerationRule",
  async function (
    this: Context<AutoModerationRule>,
    _id: string,
    props: AutoModerationRulePropsNormalized,
  ): Promise<AutoModerationRule> {
    const api = createDiscordApi(props);
    const guildId = props.guild;

    const exemptRoleIds = props.exemptRoles ?? [];
    const exemptChannelIds = props.exemptChannels ?? [];

    const body = {
      name: props.name,
      event_type: props.eventType,
      trigger_type: props.triggerType,
      trigger_metadata: props.triggerMetadata,
      actions: props.actions,
      enabled: props.enabled ?? false,
      exempt_roles: exemptRoleIds,
      exempt_channels: exemptChannelIds,
    };

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(
            `/guilds/${guildId}/auto-moderation/rules/${this.output.id}`,
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

    let ruleId = this.output?.id;
    let ruleData: DiscordApiAutoModerationRule | undefined;

    if (this.phase === "create" || !ruleId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const rules = await api.get<DiscordApiAutoModerationRule[]>(
            `/guilds/${guildId}/auto-moderation/rules`,
          );
          ruleData = rules.find((r) => r.name === props.name);
          if (ruleData) {
            ruleId = ruleData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!ruleId || this.isReplacement) {
        ruleData = await api.post<DiscordApiAutoModerationRule>(
          `/guilds/${guildId}/auto-moderation/rules`,
          body,
        );
        ruleId = ruleData.id;
      }
    } else {
      ruleData = await api.patch<DiscordApiAutoModerationRule>(
        `/guilds/${guildId}/auto-moderation/rules/${ruleId}`,
        body,
      );
    }

    if (!ruleData) {
      throw new Error(`Failed to find auto moderation rule ${ruleId}`);
    }

    return {
      id: ruleData.id,
      guildId,
      name: ruleData.name,
      eventType: ruleData.event_type,
      triggerType: ruleData.trigger_type,
      triggerMetadata: ruleData.trigger_metadata,
      actions: ruleData.actions,
      enabled: ruleData.enabled,
      exemptRoleIds: ruleData.exempt_roles,
      exemptChannelIds: ruleData.exempt_channels,
      type: "discord::AutoModerationRule",
    } as any as AutoModerationRule;
  },
);

/**
 * Type guard for AutoModerationRule resource
 */
export function isAutoModerationRule(
  resource: unknown,
): resource is AutoModerationRule {
  return (resource as any)?.[ResourceKind] === "discord::AutoModerationRule";
}
