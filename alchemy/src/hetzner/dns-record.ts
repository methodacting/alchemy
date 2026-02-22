import { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createHetznerApi, HetznerApiOptions } from "./api.ts";
import { isDNSZone, type DNSZone } from "./dns-zone.ts";
import type { HetznerDNSRecord, HetznerRRSet } from "./types.ts";

export interface DNSRecordProps extends HetznerApiOptions {
  /**
   * The DNS Zone to add the record to
   */
  zone: string | number | DNSZone;

  /**
   * Name of the record (e.g. "www", "api", or "@")
   */
  name: string;

  /**
   * DNS type (e.g. "A", "AAAA", "CNAME", "TXT")
   */
  type: string;

  /**
   * Value(s) for the record
   */
  value: string | string[];

  /**
   * TTL for this record set
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
}

export type DNSRecord = Omit<DNSRecordProps, "adopt" | "token" | "zone"> & {
  id: string;
  zone: string;
  records: HetznerDNSRecord[];
  type: "hetzner::DNSRecord";
};

/**
 * Creates a Hetzner Cloud DNS Record (RRSet).
 *
 * @example
 * const record = await DNSRecord("web-ip", {
 *   zone: "run.actor",
 *   name: "www",
 *   type: "A",
 *   value: "1.2.3.4"
 * });
 */
export const DNSRecord = Resource(
  "hetzner::DNSRecord",
  async function (
    this: Context<DNSRecord>,
    id: string,
    props: DNSRecordProps,
  ): Promise<DNSRecord> {
    const api = createHetznerApi(props);
    const zoneId = isDNSZone(props.zone)
      ? props.zone.id
      : props.zone.toString();
    const rrsetName = props.name;
    const rrsetType = props.type;

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.delete(`/zones/${zoneId}/rrsets/${this.output.id}`);
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
      if (this.output.name !== props.name || this.output.type !== props.type) {
        return this.replace(true);
      }
    }

    let rrsetId = this.output?.id;
    let rrsetData: HetznerRRSet | undefined;

    const desiredRecords: HetznerDNSRecord[] = (
      Array.isArray(props.value) ? props.value : [props.value]
    ).map((v) => ({ value: v }));

    if (this.phase === "create" || !rrsetId) {
      if (props.adopt && !this.isReplacement) {
        try {
          // Hetzner RRSet ID format is name/type
          const searchId = `${rrsetName}/${rrsetType}`;
          const response = await api.get<{ rrset: HetznerRRSet }>(
            `/zones/${zoneId}/rrsets/${searchId}`,
          );
          rrsetData = response.rrset;
          rrsetId = rrsetData.id;
        } catch (e) {
          /* ignore */
        }
      }

      if (!rrsetId || this.isReplacement) {
        const response = await api.post<{ rrset: HetznerRRSet }>(
          `/zones/${zoneId}/rrsets`,
          {
            name: rrsetName,
            type: rrsetType,
            ttl: props.ttl,
            records: desiredRecords,
            labels: props.labels,
          },
        );
        rrsetData = response.rrset;
        rrsetId = rrsetData.id;
      }
    } else {
      // Update mutable properties (value/records, ttl, labels)
      if (
        JSON.stringify(this.output.records) !==
          JSON.stringify(desiredRecords) ||
        props.ttl !== this.output.ttl ||
        JSON.stringify(props.labels) !== JSON.stringify(this.output.labels)
      ) {
        const response = await api.put<{ rrset: HetznerRRSet }>(
          `/zones/${zoneId}/rrsets/${rrsetId}`,
          {
            name: rrsetName,
            type: rrsetType,
            ttl: props.ttl,
            records: desiredRecords,
            labels: props.labels,
          },
        );
        rrsetData = response.rrset;
      } else {
        const response = await api.get<{ rrset: HetznerRRSet }>(
          `/zones/${zoneId}/rrsets/${rrsetId}`,
        );
        rrsetData = response.rrset;
      }
    }

    return {
      id: rrsetData!.id,
      zone: zoneId,
      name: rrsetData!.name,
      type: rrsetData!.type,
      value: rrsetData!.records.map((r) => r.value),
      records: rrsetData!.records,
      ttl: rrsetData!.ttl ?? undefined,
      labels: rrsetData!.labels,
      type: "hetzner::DNSRecord",
    };
  },
);

/**
 * Type guard for DNSRecord resource
 */
export function isDNSRecord(resource: unknown): resource is DNSRecord {
  return (resource as any)?.[ResourceKind] === "hetzner::DNSRecord";
}
