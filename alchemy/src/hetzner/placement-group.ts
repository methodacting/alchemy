import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";

export interface PlacementGroupProps extends HetznerApiOptions {
  /**
   * Name of the placement group
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Type of the placement group
   * @default "spread"
   */
  type?: "spread";

  /**
   * User labels
   */
  labels?: Record<string, string>;

  /**
   * Whether to adopt an existing resource
   * @default false
   */
  adopt?: boolean;
}

export type PlacementGroup = Omit<PlacementGroupProps, "adopt" | "token" | "type"> & {
  id: string;
  name: string;
  placementGroupType: "spread";
  servers: number[];
  created: string;
  type: "hetzner::PlacementGroup";
};

/**
 * Creates a Hetzner Cloud Placement Group.
 *
 * @example
 * const pg = await PlacementGroup("my-pg", {
 *   type: "spread"
 * });
 */
export const PlacementGroup = Resource(
  "hetzner::PlacementGroup",
  async function (
    this: Context<PlacementGroup>,
    id: string,
    props: PlacementGroupProps
  ): Promise<PlacementGroup> {
    const api = createHetznerApi(props);
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/placement_groups/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.placementGroupType !== props.type && props.type !== undefined) {
        return this.replace(true);
      }
    }

    let pgId = this.output?.id;
    let pgData: any;

    if (this.phase === "create" || !pgId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { placement_groups } = await api.get<{ placement_groups: any[] }>(`/placement_groups?name=${name}`);
          if (placement_groups.length > 0) {
            pgId = placement_groups[0].id;
            pgData = placement_groups[0];
          }
        } catch (e) { /* ignore */ }
      }

      if (!pgId || this.isReplacement) {
        const response = await api.post<{ placement_group: any }>(
          "/placement_groups",
          {
            name,
            type: props.type ?? "spread",
            labels: props.labels,
          }
        );
        pgData = response.placement_group;
        pgId = pgData.id;
      }
    } else {
      // Update mutable properties (name, labels)
      if (props.name !== this.output.name || JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)) {
        const response = await api.put<{ placement_group: any }>(`/placement_groups/${pgId}`, {
          name,
          labels: props.labels,
        });
        pgData = response.placement_group;
      } else {
        const response = await api.get<{ placement_group: any }>(`/placement_groups/${pgId}`);
        pgData = response.placement_group;
      }
    }

    return {
      id: pgData.id.toString(),
      name: pgData.name,
      placementGroupType: pgData.type,
      servers: pgData.servers,
      labels: pgData.labels,
      created: pgData.created,
      type: "hetzner::PlacementGroup",
    };
  }
);

/**
 * Type guard for PlacementGroup resource
 */
export function isPlacementGroup(resource: any): resource is PlacementGroup {
  return resource?.[ResourceKind] === "hetzner::PlacementGroup";
}
