import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDynadotApi, type DynadotApiOptions } from "./api.ts";
import { isDomain, type Domain } from "./domain.ts";
import type {
  NormalizedRecord,
  DynadotV3NameServerSettings,
  DynadotV3MainDomain,
  DynadotV3SubDomain,
} from "./types.ts";

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
  dnsType: string;

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

export type DNSRecord = Omit<
  DNSRecordProps,
  "adopt" | "token" | "apiKey" | "apiSecret" | "domain"
> &
  Resource<"dynadot::DNSRecord"> & {
    id: string;
    domainName: string;
    type: "dynadot::DNSRecord";
  };

type DNSRecordPropsNormalized = Omit<DNSRecordProps, "domain"> & {
  domain: string;
};

export function DNSRecord(
  id: string,
  props: DNSRecordProps,
): Promise<DNSRecord> {
  return _DNSRecord(id, {
    ...props,
    domain: isDomain(props.domain) ? props.domain.domainName : props.domain,
  });
}

interface GetDnsCommandResponse {
  GetDns: {
    NameServerSettings: DynadotV3NameServerSettings;
  };
}

/**
 * Creates a Dynadot DNS Record using V3 api3.json.
 */
const _DNSRecord = Resource(
  "dynadot::DNSRecord",
  async function (
    this: Context<DNSRecord>,
    _id: string,
    props: DNSRecordPropsNormalized,
  ): Promise<DNSRecord> {
    const api = createDynadotApi(props);
    const domainName = props.domain;
    const host = props.host ?? "@";
    const dnsType = props.dnsType.toLowerCase();

    // Virtual ID for the record
    const recordId = `${host}/${props.dnsType}`;

    const fetchRecords = async (): Promise<{
      mainRecords: NormalizedRecord[];
      subRecords: NormalizedRecord[];
    }> => {
      try {
        const response = await api.get<GetDnsCommandResponse>("get_dns", {
          domain: domainName,
        });
        const settings = response.GetDns?.NameServerSettings || {};

        const mainRecords: NormalizedRecord[] = (
          settings.MainDomains || []
        ).map((r: DynadotV3MainDomain) => ({
          host: "@",
          type: (r.RecordType || "").toLowerCase(),
          value: r.Value || "",
          value2: r.Value2 || "",
        }));

        const subRecords: NormalizedRecord[] = (settings.SubDomains || []).map(
          (r: DynadotV3SubDomain) => ({
            host: r.Subhost ?? r.SubHost ?? "",
            type: (r.RecordType || "").toLowerCase(),
            value: r.Value || "",
            value2: r.Value2 || "",
          }),
        );

        // De-duplicate by host, type, and value to prevent accumulation
        const uniqueMain: NormalizedRecord[] = [];
        for (const r of mainRecords) {
          if (
            !uniqueMain.find((u) => u.type === r.type && u.value === r.value)
          ) {
            uniqueMain.push(r);
          }
        }

        const uniqueSub: NormalizedRecord[] = [];
        for (const r of subRecords) {
          if (
            !uniqueSub.find(
              (u) =>
                u.host === r.host && u.type === r.type && u.value === r.value,
            )
          ) {
            uniqueSub.push(r);
          }
        }

        return { mainRecords: uniqueMain, subRecords: uniqueSub };
      } catch (e: unknown) {
        const message = (e as Error).message;
        if (message?.includes("find"))
          return { mainRecords: [], subRecords: [] };
        throw e;
      }
    };

    const submitRecords = async (
      main: NormalizedRecord[],
      sub: NormalizedRecord[],
    ) => {
      const params: Record<string, string | number | boolean | undefined> = {
        domain: domainName,
        ttl: props.ttl ?? 3600,
      };

      main.forEach((r, i) => {
        params[`main_record_type${i}`] = r.type;
        params[`main_record${i}`] = r.value;
        if (r.value2) params[`main_recordx${i}`] = r.value2;
      });

      sub.forEach((r, i) => {
        params[`subdomain${i}`] = r.host;
        params[`sub_record_type${i}`] = r.type;
        params[`sub_record${i}`] = r.value;
        if (r.value2) params[`sub_recordx${i}`] = r.value2;
      });

      try {
        await api.post<{}>("set_dns2", params);
      } catch (e: unknown) {
        const message = (e as Error).message;
        if (message?.includes("at least one DNS record")) {
          return;
        }
        throw e;
      }
    };

    if (this.phase === "delete") {
      if (this.output) {
        const deleteHost = this.output.host ?? host;
        const deleteType = (this.output.dnsType ?? props.dnsType).toLowerCase();
        const deleteValue = this.output.value ?? props.value;

        const { mainRecords, subRecords } = await fetchRecords();

        const isRoot = deleteHost === "@" || deleteHost === "";
        const updatedMain = isRoot
          ? mainRecords.filter(
              (r) => !(r.type === deleteType && r.value === deleteValue),
            )
          : mainRecords;

        const updatedSub = !isRoot
          ? subRecords.filter(
              (r) =>
                !(
                  r.host === deleteHost &&
                  r.type === deleteType &&
                  r.value === deleteValue
                ),
            )
          : subRecords;

        await submitRecords(updatedMain, updatedSub);
      }
      return this.destroy();
    }

    if (this.phase === "update" && this.output) {
      if (this.output.host !== host || this.output.dnsType !== props.dnsType) {
        return this.replace(true);
      }
    }

    const { mainRecords, subRecords } = await fetchRecords();
    const isRoot = host === "@" || host === "";

    if (isRoot) {
      // Find exact match to update, or add new
      const existingIndex = mainRecords.findIndex((r) => r.type === dnsType);
      const record: NormalizedRecord = {
        host: "@",
        type: dnsType,
        value: props.value,
      };
      if (existingIndex >= 0) {
        mainRecords[existingIndex] = record;
      } else {
        mainRecords.push(record);
      }
    } else {
      // Find exact match to update (same host and type), or add new
      const existingIndex = subRecords.findIndex(
        (r) => r.host === host && r.type === dnsType,
      );
      const record: NormalizedRecord = {
        host: host,
        type: dnsType,
        value: props.value,
      };
      if (existingIndex >= 0) {
        subRecords[existingIndex] = record;
      } else {
        subRecords.push(record);
      }
    }

    await submitRecords(mainRecords, subRecords);

    return {
      id: recordId,
      domainName: domainName,
      host: host,
      dnsType: props.dnsType,
      value: props.value,
      ttl: props.ttl,
      type: "dynadot::DNSRecord",
    } as DNSRecord;
  },
);

/**
 * Type guard for DNSRecord resource
 */
export function isDNSRecord(resource: unknown): resource is DNSRecord {
  return (resource as any)?.[ResourceKind] === "dynadot::DNSRecord";
}
