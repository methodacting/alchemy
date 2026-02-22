import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createLinearClient,
  linearGraphql,
  type LinearApiOptions,
} from "./api.ts";
import { isTeam, type LinearTeam } from "./team.ts";
import {
  PROJECT_CREATE_MUTATION,
  PROJECT_DELETE_MUTATION,
  PROJECT_QUERY,
  PROJECT_UPDATE_MUTATION,
} from "./graphql.ts";
import type {
  LinearProjectNode,
  ProjectCreateResponse,
  ProjectDeleteResponse,
  ProjectQueryResponse,
  ProjectUpdateResponse,
} from "./queries.ts";

export interface ProjectProps extends LinearApiOptions {
  /**
   * Name of the project
   */
  name: string;

  /**
   * Description of the project
   */
  description?: string;

  /**
   * List of team IDs or Team resources associated with the project
   */
  teams: Array<string | LinearTeam>;

  /**
   * Whether to adopt an existing project by ID
   * @default false
   */
  adopt?: boolean;
}

export type LinearProject = Omit<
  ProjectProps,
  "adopt" | "token" | "apiKey" | "teams"
> & {
  id: string;
  teamIds: string[];
  type: "linear::Project";
};

type ProjectPropsNormalized = Omit<ProjectProps, "teams"> & {
  teams: string[];
};

export function Project(
  id: string,
  props: ProjectProps,
): Promise<LinearProject> {
  return _Project(id, {
    ...props,
    teams: props.teams.map((team) =>
      isTeam(team) ? team.id : team.toString(),
    ),
  });
}

/**
 * Manages a Linear Project.
 *
 * @example
 * const project = await Project("v1-launch", {
 *   name: "V1 Launch",
 *   teams: [engTeam]
 * });
 */
const _Project = Resource(
  "linear::Project",
  async function (
    this: Context<LinearProject>,
    id: string,
    props: ProjectPropsNormalized,
  ): Promise<LinearProject> {
    const client = createLinearClient(props);
    const teamIds = props.teams;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await linearGraphql<ProjectDeleteResponse>(
            client,
            PROJECT_DELETE_MUTATION,
            {
              id: this.output.id,
            },
          );
        } catch (error: unknown) {
          const message = (error as Error).message;
          if (!message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let projectId = this.output?.id;
    let projectData: LinearProjectNode | undefined;

    if (this.phase === "create" || !projectId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const existing = await linearGraphql<ProjectQueryResponse>(
            client,
            PROJECT_QUERY,
            {
              id,
            },
          );
          projectData = existing.project;
          projectId = projectData.id;
        } catch (e) {
          /* ignore */
        }
      }

      if (!projectId || this.isReplacement) {
        const created = await linearGraphql<ProjectCreateResponse>(
          client,
          PROJECT_CREATE_MUTATION,
          {
            input: {
              name: props.name,
              description: props.description,
              teamIds,
            },
          },
        );
        projectData = created.projectCreate.project;
        projectId = projectData.id;
      }
    } else {
      const updated = await linearGraphql<ProjectUpdateResponse>(
        client,
        PROJECT_UPDATE_MUTATION,
        {
          id: projectId,
          input: {
            name: props.name,
            description: props.description,
            teamIds,
          },
        },
      );
      projectData = updated.projectUpdate.project;
    }

    if (!projectId) {
      throw new Error(`Failed to find project ${id}`);
    }

    if (!projectData) {
      const fetched = await linearGraphql<ProjectQueryResponse>(
        client,
        PROJECT_QUERY,
        { id: projectId },
      );
      projectData = fetched.project;
    }

    return {
      id: projectId,
      name: projectData.name,
      description: projectData.description ?? undefined,
      teamIds: projectData.teams?.nodes.map((team) => team.id) ?? teamIds,
      type: "linear::Project",
    };
  },
);

/**
 * Type guard for Project resource
 */
export function isProject(resource: unknown): resource is LinearProject {
  return (resource as any)?.[ResourceKind] === "linear::Project";
}
