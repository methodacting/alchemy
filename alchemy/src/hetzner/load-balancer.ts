import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isCertificate, type Certificate } from "./certificate.ts";
import { isNetwork, type Network } from "./network.ts";
import { isServer, type Server } from "./server.ts";
import type {
  HetznerLoadBalancerAlgorithm,
  HetznerLoadBalancerService,
  HetznerLoadBalancerTarget,
  HetznerLoadBalancerType,
  HetznerLocation,
  HetznerNetworkZone,
} from "./types.ts";
import { poll } from "../util/poll.ts";

export type LoadBalancerApplyTo =
  | { type: "server"; server: string | number | Server; usePrivateIp?: boolean }
  | { type: "label_selector"; selector: string; usePrivateIp?: boolean }
  | { type: "ip"; ip: string };

export interface LoadBalancerProps extends HetznerApiOptions {
  /**
   * Name of the load balancer
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Load balancer type (e.g. "lb11", "lb21")
   * Immutable: Changing this triggers replacement.
   */
  loadBalancerType: HetznerLoadBalancerType;

  /**
   * Algorithm used by the load balancer
   */
  algorithm?: HetznerLoadBalancerAlgorithm;

  /**
   * Location (e.g. "nbg1", "fsn1")
   * Only one of location or networkZone can be set.
   * Immutable: Changing this triggers replacement.
   */
  location?: HetznerLocation;

  /**
   * Network zone (e.g. "eu-central")
   * Only one of location or networkZone can be set.
   * Immutable: Changing this triggers replacement.
   */
  networkZone?: HetznerNetworkZone;

  /**
   * Services provided by the load balancer
   */
  services?: Array<
    Omit<HetznerLoadBalancerService, "http"> & {
      http?: Omit<
        NonNullable<HetznerLoadBalancerService["http"]>,
        "certificates"
      > & {
        certificates?: Array<number | string | Certificate>;
      };
    }
  >;

  /**
   * Targets for the load balancer
   */
  targets?: LoadBalancerApplyTo[];

  /**
   * Private network to attach the load balancer to
   */
  network?: string | number | Network;

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

export type LoadBalancer = Omit<
  LoadBalancerProps,
  "adopt" | "token" | "targets" | "network"
> & {
  id: string;
  name: string;
  publicIpv4: string;
  publicIpv6: string;
  network?: string;
  targets: HetznerLoadBalancerTarget[];
  created: string;
  type: "hetzner::LoadBalancer";
};

/**
 * Creates a Hetzner Cloud Load Balancer.
 *
 * @example
 * const lb = await LoadBalancer("web-lb", {
 *   loadBalancerType: "lb11",
 *   location: "nbg1",
 *   services: [
 *     { protocol: "http", listen_port: 80, destination_port: 80 }
 *   ]
 * });
 */
export const LoadBalancer = Resource(
  "hetzner::LoadBalancer",
  async function (
    this: Context<LoadBalancer>,
    id: string,
    props: LoadBalancerProps,
  ): Promise<LoadBalancer> {
    const api = createHetznerApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/load_balancers/${this.output.id}`);
        } catch (error: any) {
          if (
            !error.message?.includes("404") &&
            !error.message?.includes("not found")
          ) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (
        this.output.loadBalancerType !== props.loadBalancerType ||
        this.output.location !== props.location ||
        this.output.networkZone !== props.networkZone
      ) {
        return this.replace(true);
      }
    }

    let lbId = this.output?.id;
    let lbData: any;

    // Normalize targets to API format
    const normalizedTargets: HetznerLoadBalancerTarget[] = (
      props.targets ?? []
    ).map((t) => {
      if (t.type === "server") {
        const serverId =
          typeof t.server === "object"
            ? parseInt(t.server.id)
            : parseInt(t.server.toString());
        return {
          type: "server",
          server: { id: serverId },
          use_private_ip: t.usePrivateIp,
        };
      }
      if (t.type === "label_selector") {
        return {
          type: "label_selector",
          label_selector: { selector: t.selector },
          use_private_ip: t.usePrivateIp,
        };
      }
      return { type: "ip", ip: { ip: t.ip } };
    });

    // Normalize network to ID
    const networkId = props.network
      ? typeof props.network === "object"
        ? parseInt(props.network.id)
        : parseInt(props.network.toString())
      : undefined;

    // Normalize services
    const normalizedServices: HetznerLoadBalancerService[] = (
      props.services ?? []
    ).map((s) => {
      const http = s.http
        ? {
            ...s.http,
            certificates: (s.http.certificates ?? [])
              .map((c) => {
                if (typeof c === "string" || typeof c === "number")
                  return parseInt(c.toString());
                if (isCertificate(c)) return parseInt(c.id);
                return 0;
              })
              .filter((id) => id > 0),
          }
        : undefined;
      return { ...s, http } as HetznerLoadBalancerService;
    });

    if (this.phase === "create" || !lbId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { load_balancers } = await api.get<{ load_balancers: any[] }>(
            `/load_balancers?name=${name}`,
          );
          if (load_balancers.length > 0) {
            lbId = load_balancers[0].id;
            lbData = load_balancers[0];
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!lbId || this.isReplacement) {
        const payload: any = {
          name,
          load_balancer_type: props.loadBalancerType,
          algorithm: props.algorithm ? { type: props.algorithm } : undefined,
          services: normalizedServices,
          targets: normalizedTargets,
          labels: props.labels,
          public_interface: networkId ? false : true,
        };

        if (props.location) payload.location = props.location;
        if (props.networkZone) payload.network_zone = props.networkZone;
        if (networkId) payload.network = networkId;

        const response = await api.post<{ load_balancer: any }>(
          "/load_balancers",
          payload,
        );
        lbData = response.load_balancer;
        lbId = lbData.id;
      }
    } else {
      // Update mutable properties
      if (
        props.name !== this.output.name ||
        props.algorithm !== this.output.algorithm ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ load_balancer: any }>(
          `/load_balancers/${lbId}`,
          {
            name,
            algorithm: props.algorithm ? { type: props.algorithm } : undefined,
            labels: props.labels,
          },
        );
        lbData = response.load_balancer;
      }

      // Sync services
      const currentServices = this.output.services ?? [];
      const desiredServices = normalizedServices;

      // Comparison is tricky because of optional fields and nested objects.
      // Simplest is to check stringified versions if order is stable, but Hetzner might reorder.
      if (JSON.stringify(currentServices) !== JSON.stringify(desiredServices)) {
        // Hetzner doesn't have a "set_services" action.
        // Must add/update/delete individually.

        for (const curr of currentServices) {
          if (
            !desiredServices.some((d) => d.listen_port === curr.listen_port)
          ) {
            await api.post(`/load_balancers/${lbId}/actions/delete_service`, {
              listen_port: curr.listen_port,
            });
          }
        }

        for (const desired of desiredServices) {
          const curr = currentServices.find(
            (c) => c.listen_port === desired.listen_port,
          );
          if (!curr) {
            await api.post(
              `/load_balancers/${lbId}/actions/add_service`,
              desired,
            );
          } else if (JSON.stringify(curr) !== JSON.stringify(desired)) {
            await api.post(
              `/load_balancers/${lbId}/actions/update_service`,
              desired,
            );
          }
        }
      }

      // Sync targets
      const currentTargets = this.output.targets ?? [];
      const desiredTargets = normalizedTargets;

      if (JSON.stringify(currentTargets) !== JSON.stringify(desiredTargets)) {
        const toRemove = currentTargets.filter(
          (c) =>
            !desiredTargets.some(
              (d) => JSON.stringify(d) === JSON.stringify(c),
            ),
        );
        const toAdd = desiredTargets.filter(
          (d) =>
            !currentTargets.some(
              (c) => JSON.stringify(c) === JSON.stringify(d),
            ),
        );

        for (const t of toRemove) {
          await api.post(`/load_balancers/${lbId}/actions/remove_target`, t);
        }
        for (const t of toAdd) {
          await api.post(`/load_balancers/${lbId}/actions/add_target`, t);
        }
      }

      // Sync network
      const currentNetworkId = this.output.network
        ? parseInt(this.output.network)
        : undefined;
      if (currentNetworkId !== networkId) {
        if (currentNetworkId) {
          await api.post(
            `/load_balancers/${lbId}/actions/detach_from_network`,
            { network: currentNetworkId },
          );
        }
        if (networkId) {
          await api.post(`/load_balancers/${lbId}/actions/attach_to_network`, {
            network: networkId,
          });
        }
      }

      const response = await api.get<{ load_balancer: any }>(
        `/load_balancers/${lbId}`,
      );
      lbData = response.load_balancer;
    }

    if (!lbData && lbId) {
      const response = await api.get<{ load_balancer: any }>(
        `/load_balancers/${lbId}`,
      );
      lbData = response.load_balancer;
    }

    return {
      id: lbData.id.toString(),
      name: lbData.name,
      loadBalancerType: lbData.load_balancer_type.name,
      algorithm: lbData.algorithm.type,
      location: lbData.location?.name,
      networkZone: lbData.location?.network_zone,
      publicIpv4: lbData.public_net.ipv4.ip,
      publicIpv6: lbData.public_net.ipv6.ip,
      network: lbData.private_net?.[0]?.network?.toString(),
      services: lbData.services,
      targets: lbData.targets,
      labels: lbData.labels,
      created: lbData.created,
      type: "hetzner::LoadBalancer",
    };
  },
);

/**
 * Type guard for LoadBalancer resource
 */
export function isLoadBalancer(resource: unknown): resource is LoadBalancer {
  return (resource as any)?.[ResourceKind] === "hetzner::LoadBalancer";
}
