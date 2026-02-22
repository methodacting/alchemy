import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createPorkbunApi, type PorkbunApiOptions } from "./api.ts";
import { isDomain, type Domain } from "./domain.ts";
import type { PorkbunDNSRecord } from "./types.ts";

export interface DNSRecordProps extends PorkbunApiOptions {
  /**
   * The domain to add the record to
   */
  domain: string | Domain;

  /**
   * Subdomain for the record (e.g. "www", "@" or blank for root)
   */
  name?: string;

  /**
   * DNS type (e.g. "A", "CNAME", "TXT")
   */
  type: string;

  /**
   * Content for the record
   */
  content: string;

  /**
   * TTL for the record (minimum 600)
   */
  ttl?: number;

  /**
   * Priority for supported record types
   */
  prio?: number;

  /**
   * Whether to adopt an existing record
   * @default false
   */
  adopt?: boolean;
}

export type DNSRecord = Omit<DNSRecordProps, "adopt" | "token" | "apiKey" | "secretApiKey" | "domain" | "type"> & {
  id: string;
  domain: string;
  dnsType: string;
  type: "porkbun::DNSRecord";
};

/**
 * Creates a Porkbun DNS Record.
 *
 * @example
 * await DNSRecord("api-target", {
 *   domain: "example.com",
 *   name: "api",
 *   type: "A",
 *   content: "1.2.3.4"
 * });
 */
export const DNSRecord = Resource(
  "porkbun::DNSRecord",
  async function (
    this: Context<DNSRecord>,
    id: string,
    props: DNSRecordProps
  ): Promise<DNSRecord> {
    const api = createPorkbunApi(props);
    const domainName = isDomain(props.domain) ? props.domain.domain : props.domain;
    const subdomain = props.name === "@" ? "" : (props.name ?? "");

    if (this.phase === "delete") {
      if (this.output?.id) {
        try {
          await api.post(`/dns/delete/${domainName}/${this.output.id}`);
        } catch (error: any) {
          if (!error.message?.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.name !== (props.name ?? "") || this.output.dnsType !== props.type) {
        return this.replace(true);
      }
    }

    let recordId = this.output?.id;
    let recordData: PorkbunDNSRecord | undefined;

    if (this.phase === "create" || !recordId) {
      if (props.adopt && !this.isReplacement) {
        try {
          const { records } = await api.post<{ records: PorkbunDNSRecord[] }>(`/dns/retrieve/${domainName}`);
          recordData = records.find(r => 
            r.name === (subdomain ? `${subdomain}.${domainName}` : domainName) && 
            r.type === props.type &&
            r.content === props.content
          );
          if (recordData) {
            recordId = recordData.id;
          }
        } catch (e) { /* ignore */ }
      }

      if (!recordId || this.isReplacement) {
        const response = await api.post<{ id: string }>(
          `/dns/create/${domainName}`,
          {
            name: subdomain,
            type: props.type,
            content: props.content,
            ttl: props.ttl?.toString(),
            prio: props.prio?.toString(),
          }
        );
        recordId = response.id;
      }
    } else {
      // Update mutable properties (content, ttl, prio)
      if (
        props.content !== this.output.content ||
        props.ttl !== this.output.ttl ||
        props.prio !== this.output.prio
      ) {
        await api.post(`/dns/edit/${domainName}/${recordId}`, {
          name: subdomain,
          type: props.type,
          content: props.content,
          ttl: props.ttl?.toString(),
          prio: props.prio?.toString(),
        });
      }
    }

    // Fetch final state
    const { records } = await api.post<{ records: PorkbunDNSRecord[] }>(`/dns/retrieve/${domainName}/${recordId}`);
    recordData = records[0];

    if (!recordData) {
      throw new Error(`Failed to retrieve record ${recordId} for domain ${domainName}`);
    }

    return {
      id: recordData.id,
      domain: domainName,
      name: props.name ?? "",
      dnsType: recordData.type,
      content: recordData.content,
      ttl: recordData.ttl ? parseInt(recordData.ttl) : undefined,
      prio: recordData.prio ? parseInt(recordData.prio) : undefined,
      type: "porkbun::DNSRecord",
    };
  }
);

/**
 * Type guard for DNSRecord resource
 */
export function isDNSRecord(resource: unknown): resource is DNSRecord {
  return (resource as any)?.[ResourceKind] === "porkbun::DNSRecord";
}
