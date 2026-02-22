import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createLinearClient, linearGraphql, type LinearApiOptions } from "./api.ts";
import {
  TEAM_CREATE_MUTATION,
  TEAM_DELETE_MUTATION,
  TEAM_QUERY,
  TEAM_UPDATE_MUTATION,
  TEAMS_QUERY,
} from "./graphql.ts";
import type {
  LinearTeamNode,
  TeamCreateResponse,
  TeamDeleteResponse,
  TeamQueryResponse,
  TeamUpdateResponse,
  TeamsQueryResponse,
} from "./queries.ts";

export interface TeamProps extends LinearApiOptions {
  /**
   * Name of the team
   */
  name: string;

  /**
   * Key of the team (e.g. "ENG")
   */
  key: string;

  /**
   * Description of the team
   */
  description?: string;

  /**
   * Whether to adopt an existing team by key
   * @default false
   */
  adopt?: boolean;
}

export type LinearTeam = Omit<TeamProps, "adopt" | "token" | "apiKey"> & {
  id: string;
  type: "linear::Team";
};

/**
 * Manages a Linear Team.
 *
 * @example
 * const team = await Team("engineering", {
 *   name: "Engineering",
 *   key: "ENG"
 * });
 */
export const Team = Resource(
  "linear::Team",
  async function (
    this: Context<LinearTeam>,
    id: string,
    props: TeamProps,
  ): Promise<LinearTeam> {
    const client = createLinearClient(props);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await linearGraphql<TeamDeleteResponse>(client, TEAM_DELETE_MUTATION, {
            id: this.output.id,
          });
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let teamId = this.output?.id;
    let teamData: LinearTeamNode | undefined;

    if (this.phase === "create" || !teamId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const existing = await linearGraphql<TeamsQueryResponse>(
            client,
            TEAMS_QUERY,
            {
              first: 50,
              filter: { key: { eq: props.key } },
            },
          );
          teamData = existing.teams.nodes.find((team) => team.key === props.key);
          if (teamData) {
            teamId = teamData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!teamId || this.isReplacement) {
        const created = await linearGraphql<TeamCreateResponse>(
          client,
          TEAM_CREATE_MUTATION,
          {
            input: {
              name: props.name,
              key: props.key,
              description: props.description,
            },
          },
        );
        teamData = created.teamCreate.team;
        teamId = teamData.id;
      }
    } else {
      const updated = await linearGraphql<TeamUpdateResponse>(
        client,
        TEAM_UPDATE_MUTATION,
        {
          id: teamId,
          input: {
            name: props.name,
            key: props.key,
            description: props.description,
          },
        },
      );
      teamData = updated.teamUpdate.team;
    }

    if (!teamId) {
      throw new Error(`Failed to find team ${id}`);
    }

    if (!teamData) {
      const fetched = await linearGraphql<TeamQueryResponse>(client, TEAM_QUERY, {
        id: teamId,
      });
      teamData = fetched.team;
    }

    return {
      id: teamId,
      name: teamData.name,
      key: teamData.key,
      description: teamData.description ?? undefined,
      type: "linear::Team",
    };
  },
);

/**
 * Type guard for Team resource
 */
export function isTeam(resource: unknown): resource is LinearTeam {
  return (resource as any)?.[ResourceKind] === "linear::Team";
}
