import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import {
  createLinearClient,
  linearGraphql,
  type LinearApiOptions,
} from "./api.ts";
import { isTeam, type LinearTeam } from "./team.ts";
import {
  ISSUE_LABEL_CREATE_MUTATION,
  ISSUE_LABEL_DELETE_MUTATION,
  ISSUE_LABEL_QUERY,
  ISSUE_LABEL_UPDATE_MUTATION,
  ISSUE_LABELS_QUERY,
} from "./graphql.ts";
import type {
  IssueLabelCreateResponse,
  IssueLabelDeleteResponse,
  IssueLabelQueryResponse,
  IssueLabelUpdateResponse,
  IssueLabelsQueryResponse,
  LinearLabelNode,
} from "./queries.ts";

export interface LabelProps extends LinearApiOptions {
  /**
   * Name of the label
   */
  name: string;

  /**
   * Hex color of the label
   */
  color?: string;

  /**
   * Team ID or Team resource associated with the label (optional for workspace labels)
   */
  team?: string | LinearTeam;

  /**
   * Whether to adopt an existing label by name
   * @default false
   */
  adopt?: boolean;
}

export type LinearLabel = Omit<
  LabelProps,
  "adopt" | "token" | "apiKey" | "team"
> & {
  id: string;
  teamId?: string;
  type: "linear::Label";
};

type LabelPropsNormalized = Omit<LabelProps, "team"> & {
  team?: string;
};

export function Label(id: string, props: LabelProps): Promise<LinearLabel> {
  return _Label(id, {
    ...props,
    team: props.team
      ? isTeam(props.team)
        ? props.team.id
        : props.team.toString()
      : undefined,
  });
}

/**
 * Manages a Linear Issue Label.
 *
 * @example
 * const bugLabel = await Label("bug", {
 *   name: "Bug",
 *   color: "#eb5757"
 * });
 */
const _Label = Resource(
  "linear::Label",
  async function (
    this: Context<LinearLabel>,
    id: string,
    props: LabelPropsNormalized,
  ): Promise<LinearLabel> {
    const client = createLinearClient(props);
    const teamId = props.team;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await linearGraphql<IssueLabelDeleteResponse>(
            client,
            ISSUE_LABEL_DELETE_MUTATION,
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

    let labelId = this.output?.id;
    let labelData: LinearLabelNode | undefined;

    if (this.phase === "create" || !labelId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const existing = await linearGraphql<IssueLabelsQueryResponse>(
            client,
            ISSUE_LABELS_QUERY,
            {
              first: 50,
              filter: {
                name: { eq: props.name },
                team: teamId ? { id: { eq: teamId } } : undefined,
              },
            },
          );
          labelData = existing.issueLabels.nodes.find(
            (label) =>
              label.name === props.name &&
              (teamId ? label.team?.id === teamId : !label.team),
          );
          if (labelData) {
            labelId = labelData.id;
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!labelId || this.isReplacement) {
        const created = await linearGraphql<IssueLabelCreateResponse>(
          client,
          ISSUE_LABEL_CREATE_MUTATION,
          {
            input: {
              name: props.name,
              color: props.color,
              teamId,
            },
          },
        );
        labelData = created.issueLabelCreate.issueLabel;
        labelId = labelData.id;
      }
    } else {
      const updated = await linearGraphql<IssueLabelUpdateResponse>(
        client,
        ISSUE_LABEL_UPDATE_MUTATION,
        {
          id: labelId,
          input: {
            name: props.name,
            color: props.color,
          },
        },
      );
      labelData = updated.issueLabelUpdate.issueLabel;
    }

    if (!labelId) {
      throw new Error(`Failed to find label ${id}`);
    }

    if (!labelData) {
      const fetched = await linearGraphql<IssueLabelQueryResponse>(
        client,
        ISSUE_LABEL_QUERY,
        { id: labelId },
      );
      labelData = fetched.issueLabel;
    }

    return {
      id: labelId,
      name: labelData.name,
      color: labelData.color ?? undefined,
      teamId: labelData.team?.id ?? teamId,
      type: "linear::Label",
    };
  },
);

/**
 * Type guard for Label resource
 */
export function isLabel(resource: unknown): resource is LinearLabel {
  return (resource as any)?.[ResourceKind] === "linear::Label";
}
