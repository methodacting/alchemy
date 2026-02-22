import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isServer, type Server } from "./server.ts";
import type { HetznerFloatingIPType, HetznerLocation } from "./types.ts";
import { poll } from "../util/poll.ts";

export interface FloatingIPProps extends HetznerApiOptions {
  /**
   * Name of the floating IP
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Type of the floating IP
   */
  type: HetznerFloatingIPType;

  /**
   * Home location of the floating IP
   * Immutable: Changing this triggers replacement.
   */
  homeLocation: HetznerLocation;

  /**
   * Server to assign the floating IP to
   */
  server?: string | number | Server;

  /**
   * Description of the floating IP
   */
  description?: string;

  /**
   * User labels
   */
  labels?: Record<string, string>;

  /**
   * Whether to adopt an existing resource
   * @default false
   */
  adopt?: boolean;

  /**
   * Whether to delete the floating IP when removed from Alchemy
   * @default true
   */
  delete?: boolean;
}

export type FloatingIP = Omit<
  FloatingIPProps,
  "adopt" | "token" | "server" | "delete"
> & {
  id: string;
  name: string;
  ip: string;
  server?: string;
  created: string;
  type: "hetzner::FloatingIP";
};

/**
 * Creates a Hetzner Cloud Floating IP.
 *
 * @example
 * const ip = await FloatingIP("web-ip", {
 *   type: "ipv4",
 *   homeLocation: "nbg1",
 *   server: myServer
 * });
 */
export const FloatingIP = Resource(
  "hetzner::FloatingIP",
  async function (
    this: Context<FloatingIP>,
    id: string,
    props: FloatingIPProps,
  ): Promise<FloatingIP> {
    const api = createHetznerApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          await api.delete(`/floating_ips/${this.output.id}`);
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
        this.output.type !== props.type ||
        this.output.homeLocation !== props.homeLocation
      ) {
        return this.replace(true);
      }
    }

    let ipId = this.output?.id;
    let ipData: any;

    const serverId = props.server
      ? typeof props.server === "object"
        ? parseInt(props.server.id)
        : parseInt(props.server.toString())
      : undefined;

    if (this.phase === "create" || !ipId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { floating_ips } = await api.get<{ floating_ips: any[] }>(
            `/floating_ips?name=${name}`,
          );
          if (floating_ips.length > 0) {
            ipId = floating_ips[0].id;
            ipData = floating_ips[0];
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!ipId || this.isReplacement) {
        const payload: any = {
          name,
          type: props.type,
          home_location: props.homeLocation,
          server: serverId,
          description: props.description,
          labels: props.labels,
        };

        const response = await api.post<{ floating_ip: any }>(
          "/floating_ips",
          payload,
        );
        ipData = response.floating_ip;
        ipId = ipData.id;
      }
    } else {
      // Update mutable properties (name, description, labels)
      if (
        props.name !== this.output.name ||
        props.description !== this.output.description ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ floating_ip: any }>(
          `/floating_ips/${ipId}`,
          {
            name,
            description: props.description,
            labels: props.labels,
          },
        );
        ipData = response.floating_ip;
      }

      // Sync assignment
      const currentServerId = this.output.server
        ? parseInt(this.output.server)
        : undefined;
      if (currentServerId !== serverId) {
        if (currentServerId) {
          await api.post(`/floating_ips/${ipId}/actions/unassign`);
          // Wait for unassign
          await poll({
            description: `floating ip ${ipId} unassignment`,
            fn: () => api.get<{ floating_ip: any }>(`/floating_ips/${ipId}`),
            predicate: (res) => res.floating_ip.server === null,
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000,
          });
        }
        if (serverId) {
          await api.post(`/floating_ips/${ipId}/actions/assign`, {
            server: serverId,
          });
          // Wait for assign
          await poll({
            description: `floating ip ${ipId} assignment to server ${serverId}`,
            fn: () => api.get<{ floating_ip: any }>(`/floating_ips/${ipId}`),
            predicate: (res) =>
              res.floating_ip.server !== null &&
              res.floating_ip.server === serverId,
            initialDelay: 1000,
            maxDelay: 5000,
            timeout: 60000,
          });
        }
        const response = await api.get<{ floating_ip: any }>(
          `/floating_ips/${ipId}`,
        );
        ipData = response.floating_ip;
      }

      if (!ipData) {
        const response = await api.get<{ floating_ip: any }>(
          `/floating_ips/${ipId}`,
        );
        ipData = response.floating_ip;
      }
    }

    return {
      id: ipData.id.toString(),
      name: ipData.name,
      type: ipData.type,
      ip: ipData.ip,
      homeLocation: ipData.home_location.name,
      server: ipData.server?.toString(),
      description: ipData.description,
      labels: ipData.labels,
      created: ipData.created,
      type: "hetzner::FloatingIP",
    } as any; // Cast because Omit and type property conflict slightly
  },
);

/**
 * Type guard for FloatingIP resource
 */
export function isFloatingIP(resource: unknown): resource is FloatingIP {
  return (resource as any)?.[ResourceKind] === "hetzner::FloatingIP";
}
