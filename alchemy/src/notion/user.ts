import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createNotionClient, type NotionApiOptions } from "./api.ts";

export interface UserProps extends NotionApiOptions {
  /**
   * The user ID to adopt
   */
  userId: string;
}

export type User = Omit<UserProps, "token"> & {
  id: string;
  name: string;
  avatarUrl?: string;
  type: "notion::User";
};

/**
 * Adopts a Notion User.
 *
 * @example
 * const user = await User("me", { userId: "USER_ID" });
 */
export const User = Resource(
  "notion::User",
  async function (
    this: Context<User>,
    id: string,
    props: UserProps,
  ): Promise<User> {
    const notion = createNotionClient(props);

    if (this.phase === "delete") {
      return this.destroy();
    }

    const userData = await notion.users.retrieve({ user_id: props.userId });

    return {
      id: userData.id,
      userId: userData.id,
      name: (userData as any).name || "Unknown",
      avatarUrl: userData.avatar_url || undefined,
      type: "notion::User",
    };
  },
);

/**
 * Type guard for User resource
 */
export function isUser(resource: any): resource is User {
  return resource?.[ResourceKind] === "notion::User";
}
