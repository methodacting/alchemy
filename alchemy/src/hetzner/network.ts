import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import type { HetznerRoute, HetznerSubnet } from "./types.ts";

export interface NetworkProps extends HetznerApiOptions {
  /**
   * Name of the network
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Main IP range of the network in CIDR notation
   * Immutable: Changing this triggers replacement.
   */
  ipRange: string;

  /**
   * Subnets to create in the network
   */
  subnets?: HetznerSubnet[];

  /**
   * Routes to create in the network
   */
  routes?: HetznerRoute[];

  /**
   * Whether to expose routes to the vSwitch
   * @default false
   */
  exposeRoutesToVswitch?: boolean;

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

export type Network = Omit<NetworkProps, "adopt" | "token"> & {
  id: string;
  name: string;
  status: string;
  created: string;
  type: "hetzner::Network";
};

/**
 * Creates a Hetzner Cloud Network.
 *
 * @example
 * const net = await Network("main-net", {
 *   ipRange: "10.0.0.0/16",
 *   subnets: [
 *     { type: "cloud", network_zone: "eu-central", ip_range: "10.0.1.0/24" }
 *   ]
 * });
 */
export const Network = Resource(
  "hetzner::Network",
  async function (
    this: Context<Network>,
    id: string,
    props: NetworkProps
  ): Promise<Network> {
    const api = createHetznerApi(props);
    const name = props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/networks/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.ipRange !== props.ipRange) {
        return this.replace(true);
      }
    }

    let networkId = this.output?.id;
    let networkData: any;

    if (this.phase === "create" || !networkId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { networks } = await api.get<{ networks: any[] }>(`/networks?name=${name}`);
          if (networks.length > 0) {
            networkId = networks[0].id;
            networkData = networks[0];
          }
        } catch (e) {
          // ignore
        }
      }

      if (!networkId || this.isReplacement) {
        const response = await api.post<{ network: any }>(
          "/networks",
          {
            name,
            ip_range: props.ipRange,
            subnets: props.subnets,
            routes: props.routes,
            expose_routes_to_vswitch: props.exposeRoutesToVswitch,
            labels: props.labels,
          }
        );
        networkData = response.network;
        networkId = networkData.id;
      }
    } else {
      // Update mutable properties (name, labels, expose_routes_to_vswitch)
      if (
        props.name !== this.output.name ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels) ||
        props.exposeRoutesToVswitch !== this.output.exposeRoutesToVswitch
      ) {
        const response = await api.put<{ network: any }>(`/networks/${networkId}`, {
          name,
          labels: props.labels,
          expose_routes_to_vswitch: props.exposeRoutesToVswitch,
        });
        networkData = response.network;
      }

      // Synchronize subnets
      const currentSubnets = this.output.subnets ?? [];
      const desiredSubnets = props.subnets ?? [];

      const subnetsToDelete = currentSubnets.filter(curr => 
        !desiredSubnets.some(next => next.ip_range === curr.ip_range && next.type === curr.type)
      );
      const subnetsToAdd = desiredSubnets.filter(next => 
        !currentSubnets.some(curr => curr.ip_range === next.ip_range && curr.type === next.type)
      );

      for (const subnet of subnetsToDelete) {
        await api.post(`/networks/${networkId}/actions/delete_subnet`, { ip_range: subnet.ip_range });
      }
      for (const subnet of subnetsToAdd) {
        await api.post(`/networks/${networkId}/actions/add_subnet`, subnet);
      }

      // Synchronize routes
      const currentRoutes = this.output.routes ?? [];
      const desiredRoutes = props.routes ?? [];

      const routesToDelete = currentRoutes.filter(curr => 
        !desiredRoutes.some(next => next.destination === curr.destination && next.gateway === curr.gateway)
      );
      const routesToAdd = desiredRoutes.filter(next => 
        !currentRoutes.some(curr => curr.destination === next.destination && curr.gateway === next.gateway)
      );

      for (const route of routesToDelete) {
        await api.post(`/networks/${networkId}/actions/delete_route`, route);
      }
      for (const route of routesToAdd) {
        await api.post(`/networks/${networkId}/actions/add_route`, route);
      }

      const response = await api.get<{ network: any }>(`/networks/${networkId}`);
      networkData = response.network;
    }

    return {
      id: networkId.toString(),
      name: networkData.name,
      ipRange: networkData.ip_range,
      subnets: networkData.subnets,
      routes: networkData.routes,
      exposeRoutesToVswitch: networkData.expose_routes_to_vswitch,
      labels: networkData.labels,
      status: networkData.status,
      created: networkData.created,
      type: "hetzner::Network",
    };
  }
);

/**
 * Type guard for Network resource
 */
export function isNetwork(resource: any): resource is Network {
  return resource?.[ResourceKind] === "hetzner::Network";
}
