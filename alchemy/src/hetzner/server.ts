import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isNetwork, type Network } from "./network.ts";
import { isPlacementGroup, type PlacementGroup } from "./placement-group.ts";
import { isSSHKey, type SSHKey } from "./ssh-key.ts";
import type {
  HetznerImage,
  HetznerLocation,
  HetznerServerType,
} from "./types.ts";
import { poll } from "../util/poll.ts";

export interface ServerProps extends HetznerApiOptions {
  /**
   * Name of the server
   * @default ${app}-${stage}-${id}
   */
  name?: string;

  /**
   * Server type (e.g. "cx22", "cpx11")
   */
  serverType: HetznerServerType;

  /**
   * Image ID or name (e.g. "ubuntu-24.04")
   */
  image: HetznerImage;

  /**
   * Location (e.g. "nbg1", "fsn1", "ash")
   * Only one of location or datacenter can be set.
   */
  location?: HetznerLocation;

  /**
   * Datacenter (e.g. "nbg1-dc3")
   * Only one of location or datacenter can be set.
   */
  datacenter?: string;

  /**
   * Start server after creation
   * @default true
   */
  startAfterCreate?: boolean;

  /**
   * User labels
   */
  labels?: Record<string, string>;

  /**
   * Cloud-init user data
   */
  userData?: string;

  /**
   * Automount volumes
   */
  automount?: boolean;

  /**
   * SSH key IDs, names, or SSHKey resource objects
   */
  sshKeys?: Array<string | number | SSHKey>;

  /**
   * Firewalls to apply
   */
  firewalls?: Array<{ firewall: string }>;

  /**
   * Networks to attach
   */
  networks?: Array<number | string | Network>;

  /**
   * Public Net configuration
   */
  publicNet?: {
    enable_ipv4?: boolean;
    enable_ipv6?: boolean;
    ipv4?: string;
    ipv6?: string;
  };

  /**
   * Placement group ID or name
   */
  placementGroup?: string | number | PlacementGroup;

  /**
   * Whether to adopt an existing resource
   * @default false
   */
  adopt?: boolean;

  /**
   * Whether to delete the server when removed from Alchemy
   * @default true
   */
  delete?: boolean;
}

export type Server = Omit<
  ServerProps,
  "adopt" | "token" | "networks" | "sshKeys" | "placementGroup" | "delete"
> & {
  id: string;
  name: string;
  serverType: HetznerServerType;
  image: HetznerImage;
  status: string;
  publicIp?: string;
  ipv6?: string;
  rootPassword?: Secret;
  networks?: string[];
  privateIps?: Record<string, string>;
  sshKeys?: string[];
  placementGroup?: string;
  floatingIps?: string[];
  created: string;
  type: "hetzner::Server";
};

/**
 * Creates a Hetzner Cloud Server.
 *
 * @example
 * const server = await Server("web-1", {
 *   serverType: "cx22",
 *   image: "ubuntu-24.04",
 *   location: "nbg1"
 * });
 */
export const Server = Resource(
  "hetzner::Server",
  async function (
    this: Context<Server>,
    id: string,
    props: ServerProps,
  ): Promise<Server> {
    const api = createHetznerApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          await api.delete(`/servers/${this.output.id}`);
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
      const typeChanged = this.output.serverType !== props.serverType;
      const imageChanged = this.output.image !== props.image;
      const locationChanged = props.location
        ? this.output.location !== props.location
        : false;
      const datacenterChanged = props.datacenter
        ? this.output.datacenter !== props.datacenter
        : false;

      if (typeChanged || imageChanged || locationChanged || datacenterChanged) {
        return this.replace(true);
      }
    }

    let serverId = this.output?.id;
    let rootPassword = this.output?.rootPassword;
    let serverData: any;

    const networkIds: number[] = (props.networks ?? [])
      .map((net) => {
        if (typeof net === "string" || typeof net === "number")
          return parseInt(net.toString());
        if (isNetwork(net)) return parseInt(net.id);
        return 0;
      })
      .filter((id) => id > 0);

    const normalizedSshKeys: Array<string | number> = (props.sshKeys ?? [])
      .map((key) => {
        if (typeof key === "string" || typeof key === "number") {
          return typeof key === "string" && !isNaN(parseInt(key))
            ? parseInt(key)
            : key;
        }
        if (isSSHKey(key)) return parseInt(key.id);
        return "";
      })
      .filter((key) => key !== "");

    // Normalize placementGroup to ID
    const placementGroupId = props.placementGroup
      ? typeof props.placementGroup === "object"
        ? parseInt(props.placementGroup.id)
        : typeof props.placementGroup === "number"
          ? props.placementGroup
          : parseInt(props.placementGroup)
      : undefined;

    if (this.phase === "create" || !serverId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { servers } = await api.get<{ servers: any[] }>(
            `/servers?name=${name}`,
          );
          if (servers.length > 0) {
            serverId = servers[0].id;
            serverData = servers[0];
          }
        } catch (e) {
          /* ignore */
        }
      }

      if (!serverId || this.isReplacement) {
        const payload: any = {
          name,
          server_type: props.serverType,
          image: props.image,
          start_after_create: props.startAfterCreate ?? true,
          labels: props.labels,
          user_data: props.userData,
          automount: props.automount,
          ssh_keys: normalizedSshKeys,
          firewalls: props.firewalls,
          networks: networkIds,
          placement_group: placementGroupId,
          public_net: props.publicNet,
        };

        if (props.location) payload.location = props.location;
        if (props.datacenter) payload.datacenter = props.datacenter;

        const response = await api.post<{
          server: any;
          root_password?: string;
        }>("/servers", payload);
        serverData = response.server;
        serverId = serverData.id;
        if (response.root_password) {
          rootPassword = new Secret(response.root_password);
        }

        await poll({
          description: `server ${serverId} initialization`,
          fn: () => api.get<{ server: any }>(`/servers/${serverId}`),
          predicate: (res) => res.server.status !== "initializing",
          initialDelay: 2000,
          maxDelay: 10000,
          timeout: 120000,
        });

        const freshResponse = await api.get<{ server: any }>(
          `/servers/${serverId}`,
        );
        serverData = freshResponse.server;
      }
    } else {
      if (
        props.name !== this.output.name ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ server: any }>(
          `/servers/${serverId}`,
          {
            name,
            labels: props.labels,
          },
        );
        serverData = response.server;
      }

      const currentNetworkIds = (this.output.networks ?? []).map((id) =>
        parseInt(id),
      );
      const desiredNetworkIds = networkIds;

      const toDetach = currentNetworkIds.filter(
        (id) => !desiredNetworkIds.includes(id),
      );
      const toAttach = desiredNetworkIds.filter(
        (id) => !currentNetworkIds.includes(id),
      );

      for (const netId of toDetach) {
        await api.post(`/servers/${serverId}/actions/detach_from_network`, {
          network: netId,
        });
      }
      for (const netId of toAttach) {
        await api.post(`/servers/${serverId}/actions/attach_to_network`, {
          network: netId,
        });
      }

      if (!serverData) {
        const response = await api.get<{ server: any }>(`/servers/${serverId}`);
        serverData = response.server;
      }
    }

    if (!serverData && serverId) {
      const response = await api.get<{ server: any }>(`/servers/${serverId}`);
      serverData = response.server;
    }

    return {
      id: serverData.id.toString(),
      name: serverData.name,
      serverType: serverData.server_type.name,
      image: serverData.image ? serverData.image.name : props.image,
      status: serverData.status,
      location: serverData.location?.name,
      datacenter: serverData.datacenter?.name,
      publicIp: serverData.public_net?.ipv4?.ip,
      ipv6: serverData.public_net?.ipv6?.ip,
      rootPassword,
      networks: (serverData.private_net ?? []).map((n: any) =>
        n.network.toString(),
      ),
      privateIps: (serverData.private_net ?? []).reduce((acc: any, n: any) => {
        acc[n.network.toString()] = n.ip;
        return acc;
      }, {}),
      sshKeys: (serverData.public_keys ?? normalizedSshKeys).map((k: any) =>
        k.toString(),
      ),
      floatingIps: (serverData.public_net?.floating_ips ?? []).map((f: any) =>
        f.toString(),
      ),
      placementGroup: serverData.placement_group?.id?.toString(),
      created: serverData.created,
      labels: serverData.labels,
      startAfterCreate: props.startAfterCreate,
      userData: props.userData,
      automount: props.automount,
      firewalls: props.firewalls,
      publicNet: props.publicNet,
      type: "hetzner::Server",
    };
  },
);

export function isServer(resource: unknown): resource is Server {
  return (resource as any)?.[ResourceKind] === "hetzner::Server";
}
