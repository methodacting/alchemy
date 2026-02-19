import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDynadotApi, type DynadotApiOptions } from "./api.ts";
import { isDomain, type Domain } from "./domain.ts";
import type { DynadotDNSSettings } from "./types.ts";

export interface DNSRecordProps extends DynadotApiOptions {
  /**
   * The domain to add the record to
   */
  domain: string | Domain;

  /**
   * Subdomain for the record (e.g. "www", "@" or blank for root)
   */
  host?: string;

  /**
   * DNS type (e.g. "A", "CNAME", "TXT")
   */
  type: string;

  /**
   * Value for the record
   */
  value: string;

  /**
   * TTL for the record
   */
  ttl?: number;

  /**
   * Whether to adopt an existing record
   * @default false
   */
  adopt?: boolean;
}

export type DNSRecord = Omit<DNSRecordProps, "adopt" | "token" | "apiKey" | "apiSecret" | "domain"> & {
  id: string;
  domainName: string;
  type: "dynadot::DNSRecord";
};

/**
 * Creates a Dynadot DNS Record.
 *
 * @example
 * await DNSRecord("web-ip", {
 *   domain: "example.com",
 *   host: "www",
 *   type: "A",
 *   value: "1.2.3.4"
 * });
 */
export const DNSRecord = Resource(
  "dynadot::DNSRecord",
  async function (
    this: Context<DNSRecord>,
    id: string,
    props: DNSRecordProps
  ): Promise<DNSRecord> {
    const api = createDynadotApi(props);
    const domainName = isDomain(props.domain) ? props.domain.domainName : props.domain;
    const host = props.host ?? "@";

    if (this.phase === "delete") {
      if (this.output) {
        // Fetch current records, remove this one, and push back
        const response = await api.get<{ dnsSettings: DynadotDNSSettings[] }>(`/domains/${domainName}/get_dns`);
        const currentRecords = response.dnsSettings ?? [];
        const updatedRecords = currentRecords.filter(r => 
          !(r.host === host && r.type === props.type && r.value === props.value)
        );
        
        await api.post(`/domains/${domainName}/set_dns`, {
          dnsSettings: updatedRecords
        });
      }
      return this.destroy();
    }

    // Dynadot doesn't have unique IDs for records in V2 API docs I saw, 
    // it uses the set_dns approach. We'll use a virtual ID.
    const recordId = `${host}/${props.type}`;

    if (this.phase === "update" && this.output) {
      if (this.output.host !== host || this.output.type !== props.type) {
        return this.replace(true);
      }
    }

    // Fetch existing records
    const response = await api.get<{ dnsSettings: DynadotDNSSettings[] }>(`/domains/${domainName}/get_dns`);
    const currentRecords = response.dnsSettings ?? [];

    const desiredRecord: DynadotDNSSettings = {
      type: props.type,
      host: host,
      value: props.value,
      ttl: props.ttl,
    };

    // Update or Add
    const existingIndex = currentRecords.findIndex(r => r.host === host && r.type === props.type);
    
    let updatedRecords: DynadotDNSSettings[];
    if (existingIndex >= 0) {
      updatedRecords = [...currentRecords];
      updatedRecords[existingIndex] = desiredRecord;
    } else {
      updatedRecords = [...currentRecords, desiredRecord];
    }

    await api.post(`/domains/${domainName}/set_dns`, {
      dnsSettings: updatedRecords
    });

    return {
      id: recordId,
      domainName: domainName,
      host: host,
      type: props.type,
      value: props.value,
      ttl: props.ttl,
      recordType: "dynadot::DNSRecord",
    } as any;
  }
);

/**
 * Type guard for DNSRecord resource
 */
export function isDNSRecord(resource: any): resource is DNSRecord {
  return resource?.[ResourceKind] === "dynadot::DNSRecord";
}
