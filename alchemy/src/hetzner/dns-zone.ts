import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { poll } from "../util/poll.ts";

export interface DNSZoneProps extends HetznerApiOptions {
  /**
   * Name of the DNS Zone (e.g. "example.com")
   */
  name: string;

  /**
   * Default TTL for the zone
   * @default 3600
   */
  ttl?: number;

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
   * Whether to delete the zone when removed from Alchemy
   * @default true
   */
  delete?: boolean;
}

export type DNSZone = Omit<DNSZoneProps, "adopt" | "token" | "delete"> & {
  id: string;
  nameservers: string[];
  status: string;
  created: string;
  type: "hetzner::DNSZone";
};

/**
 * Creates a Hetzner Cloud DNS Zone.
 *
 * @example
 * const zone = await DNSZone("main", {
 *   name: "run.actor",
 *   adopt: true
 * });
 */
export const DNSZone = Resource(
  "hetzner::DNSZone",
  async function (
    this: Context<DNSZone>,
    id: string,
    props: DNSZoneProps
  ): Promise<DNSZone> {
    const api = createHetznerApi(props);
    const name = props.name;

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          await api.delete(`/zones/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("404") && !error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    let zoneId = this.output?.id;
    let zoneData: any;

    if (this.phase === "create" || !zoneId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { zones } = await api.get<{ zones: any[] }>(`/zones?name=${name}`);
          if (zones.length > 0) {
            zoneId = zones[0].id;
            zoneData = zones[0];
          }
        } catch (e) { /* ignore */ }
      }

      if (!zoneId || this.isReplacement) {
        const response = await api.post<{ zone: any }>(
          "/zones",
          {
            name,
            ttl: props.ttl ?? 3600,
            labels: props.labels,
            mode: "primary",
          }
        );
        zoneData = response.zone;
        zoneId = zoneData.id;

        // Wait for zone to be ok and have nameservers
        await poll({
            description: `zone ${zoneId} initialization`,
            fn: () => api.get<{ zone: any }>(`/zones/${zoneId}`),
            predicate: (res) => res.zone.status === "ok" && (res.zone.authoritative_nameservers?.assigned?.length ?? 0) > 0,
            initialDelay: 2000,
            maxDelay: 10000,
            timeout: 60000
        });

        const freshResponse = await api.get<{ zone: any }>(`/zones/${zoneId}`);
        zoneData = freshResponse.zone;
      }
    } else {
      // Update mutable properties (name, labels, ttl)
      // Note: Changing name of a zone is usually not possible without replacement, 
      // but Hetzner PUT /zones/{id} documentation shows it might be allowed for some fields.
      if (
        props.name !== this.output.name ||
        props.ttl !== this.output.ttl ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ zone: any }>(`/zones/${zoneId}`, {
          name,
          ttl: props.ttl ?? 3600,
          labels: props.labels,
        });
        zoneData = response.zone;
      } else {
        const response = await api.get<{ zone: any }>(`/zones/${zoneId}`);
        zoneData = response.zone;
      }
    }

    return {
      id: zoneData.id.toString(),
      name: zoneData.name,
      ttl: zoneData.ttl,
      labels: zoneData.labels,
      nameservers: zoneData.authoritative_nameservers?.assigned ?? [],
      status: zoneData.status,
      created: zoneData.created,
      type: "hetzner::DNSZone",
    };
  }
);

/**
 * Type guard for DNSZone resource
 */
export function isDNSZone(resource: any): resource is DNSZone {
  return resource?.[ResourceKind] === "hetzner::DNSZone";
}
