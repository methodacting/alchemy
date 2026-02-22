import type { Context } from "../../context.ts";
import { Resource, ResourceKind } from "../../resource.ts";
import { createTwitchClient, type TwitchApiOptions } from "./client.ts";

export interface CustomRewardProps extends TwitchApiOptions {
  /**
   * Broadcaster ID (optional, resolved from refresh token if omitted)
   */
  broadcasterId?: string;

  /**
   * Reward title
   */
  title: string;

  /**
   * Reward cost
   */
  cost: number;

  /**
   * Reward prompt
   */
  prompt?: string;

  /**
   * Background color (hex)
   */
  backgroundColor?: string;

  /**
   * Global cooldown in seconds
   */
  globalCooldown?: number;

  /**
   * Whether to adopt an existing reward by title
   * @default false
   */
  adopt?: boolean;

  /**
   * Reward ID (optional override)
   */
  rewardId?: string;
}

export type CustomReward = Omit<
  CustomRewardProps,
  "clientId" | "clientSecret" | "refreshToken" | "adopt"
> &
  Resource<"twitch::CustomReward"> & {
    /**
     * Reward ID.
     */
    id: string;

    /**
     * Broadcaster ID.
     */
    broadcasterId: string;

    /**
     * Whether reward is enabled.
     */
    enabled: boolean;

    /**
     * Resource type identifier.
     * @internal
     */
    type: "twitch::CustomReward";
  };

type RewardData = {
  id: string;
  title: string;
  cost: number;
  prompt?: string | null;
  backgroundColor?: string | null;
  globalCooldown?: number | null;
  isEnabled?: boolean;
};

/**
 * Manages a Twitch Custom Channel Points Reward.
 */
export const CustomReward = Resource(
  "twitch::CustomReward",
  async function (
    this: Context<CustomReward>,
    _id: string,
    props: CustomRewardProps,
  ): Promise<CustomReward> {
    if (this.phase === "delete") {
      if (this.scope.local) {
        return this.destroy();
      }

      const { client, userId } = await createTwitchClient(props);
      const broadcasterId = props.broadcasterId ?? userId;

      if (this.output?.id) {
        try {
          await client.channelPoints.deleteCustomReward(
            broadcasterId,
            this.output.id,
          );
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("Not Found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    const broadcasterId =
      props.broadcasterId ?? this.output?.broadcasterId ?? "local";

    if (this.scope.local) {
      return {
        id: props.rewardId ?? this.output?.id ?? `${_id}-local`,
        broadcasterId,
        title: props.title,
        cost: props.cost,
        prompt: props.prompt,
        backgroundColor: props.backgroundColor,
        globalCooldown: props.globalCooldown,
        enabled: true,
        type: "twitch::CustomReward",
      };
    }

    const { client, userId } = await createTwitchClient(props);
    const resolvedBroadcasterId = props.broadcasterId ?? userId;

    let rewardId = props.rewardId ?? this.output?.id;
    let rewardData: RewardData | undefined;

    if (this.phase === "create" || !rewardId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const rewards = await client.channelPoints.getCustomRewards(
            resolvedBroadcasterId,
          );
          rewardData = rewards.find((r) => r.title === props.title);
          if (rewardData) {
            rewardId = rewardData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!rewardId || this.isReplacement) {
        rewardData = await client.channelPoints.createCustomReward(
          resolvedBroadcasterId,
          {
            title: props.title,
            cost: props.cost,
            prompt: props.prompt,
            backgroundColor: props.backgroundColor,
            isGlobalCooldownEnabled: props.globalCooldown !== undefined,
            globalCooldown: props.globalCooldown,
          },
        );
        rewardId = rewardData.id;
      }
    } else {
      rewardData = await client.channelPoints.updateCustomReward(
        resolvedBroadcasterId,
        rewardId,
        {
          title: props.title,
          cost: props.cost,
          prompt: props.prompt,
          backgroundColor: props.backgroundColor,
          isGlobalCooldownEnabled: props.globalCooldown !== undefined,
          globalCooldown: props.globalCooldown,
        },
      );
    }

    if (!rewardData) {
      throw new Error(`Failed to resolve reward ${rewardId}`);
    }

    return {
      id: rewardData.id,
      broadcasterId: resolvedBroadcasterId,
      title: rewardData.title,
      cost: rewardData.cost,
      prompt: rewardData.prompt ?? undefined,
      backgroundColor: rewardData.backgroundColor ?? undefined,
      globalCooldown: rewardData.globalCooldown ?? undefined,
      enabled: rewardData.isEnabled ?? true,
      type: "twitch::CustomReward",
    };
  },
);

/**
 * Type guard for CustomReward resource
 */
export function isCustomReward(resource: unknown): resource is CustomReward {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as { [ResourceKind]?: string })[ResourceKind] ===
      "twitch::CustomReward"
  );
}
