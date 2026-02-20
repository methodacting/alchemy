import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDynadotApi, type DynadotApiOptions } from "./api.ts";
import type { DynadotDomainDetails } from "./types.ts";

export interface DomainProps extends DynadotApiOptions {
  /**
   * The domain name to manage (e.g. "example.com")
   */
  domainName: string;

  /**
   * Nameservers for the domain
   */
  nameservers?: string[];

  /**
   * Whether to enable auto-renewal
   * @default true
   */
  autoRenew?: boolean;

  /**
   * Whether to enable WHOIS privacy
   * @default true
   */
  whoisPrivacy?: boolean;

  /**
   * Registration duration in years
   * @default 1
   */
  duration?: number;

  /**
   * Whether to adopt an existing domain
   * @default false
   */
  adopt?: boolean;
}

export type Domain = Omit<DomainProps, "adopt" | "token" | "apiKey" | "apiSecret"> & {
  id: string;
  status: string;
  expirationDate: string;
  creationDate: string;
  type: "dynadot::Domain";
};

/**
 * Helper to map raw Dynadot API response to our internal details type
 */
function mapRawToDetails(raw: any): DynadotDomainDetails {
  return {
    domainName: raw.Name || raw.DomainName,
    status: raw.Status,
    expirationDate: raw.Expiration?.toString(),
    creationDate: raw.Registration?.toString(),
    autoRenew: raw.AutoRenew === "yes" ? "on" : "off",
    whoisPrivacy: raw.WhoisPrivacy === "yes" ? "on" : "off",
    nameservers: raw.NameServerSettings?.NameServers,
  };
}

/**
 * Manages a Dynadot Domain registration and settings.
 *
 * @example
 * const domain = await Domain("main", {
 *   domainName: "example.com",
 *   adopt: true,
 *   autoRenew: true
 * });
 */
export const Domain = Resource(
  "dynadot::Domain",
  async function (
    this: Context<Domain>,
    id: string,
    props: DomainProps
  ): Promise<Domain> {
    const api = createDynadotApi(props);
    const domainName = props.domainName;

    // Deletion is a NOOP for domains
    if (this.phase === "delete") {
      return this.destroy();
    }

    let domainData: DynadotDomainDetails | undefined;

    if (this.phase === "create" || !this.output) {
      // Check if domain is already in account
      try {
        const response = await api.get<{ DomainInfo: any }>(`/domains/${domainName}`);
        if (response.DomainInfo) {
          domainData = mapRawToDetails(response.DomainInfo);
        }
      } catch (e) { /* ignore */ }

      if (domainData) {
        if (!props.adopt && !this.isReplacement) {
          throw new Error(`Domain "${domainName}" already exists in your Dynadot account. Use adopt: true to manage it.`);
        }
      } else {
        // Register domain
        const response = await api.post<any>("/domains/register", {
          domainName,
          duration: props.duration ?? 1,
        });
        // Registration might return basic info, but we fetch full info next
        const info = await api.get<{ DomainInfo: any }>(`/domains/${domainName}`);
        domainData = mapRawToDetails(info.DomainInfo);
      }
    } else {
      // Use existing output state
      domainData = {
        domainName: this.output.domainName,
        status: this.output.status,
        expirationDate: this.output.expirationDate,
        creationDate: this.output.creationDate,
        autoRenew: this.output.autoRenew ? "on" : "off",
        whoisPrivacy: this.output.whoisPrivacy ? "on" : "off",
      };
    }

    if (!domainData) {
      throw new Error(`Failed to find domain "${domainName}" in account`);
    }

    // Sync settings
    if (props.autoRenew !== undefined) {
      const currentAutoRenew = domainData.autoRenew === "on";
      if (currentAutoRenew !== props.autoRenew) {
        await api.post(`/domains/${domainName}/set_auto_renew`, {
          status: props.autoRenew ? "on" : "off"
        });
      }
    }

    if (props.whoisPrivacy !== undefined) {
      const currentPrivacy = domainData.whoisPrivacy === "on";
      if (currentPrivacy !== props.whoisPrivacy) {
        await api.post(`/domains/${domainName}/set_privacy`, {
          status: props.whoisPrivacy ? "on" : "off"
        });
      }
    }

    if (props.nameservers) {
      await api.post(`/domains/${domainName}/set_ns`, {
        nameservers: props.nameservers
      });
    }

    return {
      id: domainName,
      domainName: domainName,
      autoRenew: props.autoRenew ?? (domainData.autoRenew === "on"),
      whoisPrivacy: props.whoisPrivacy ?? (domainData.whoisPrivacy === "on"),
      nameservers: props.nameservers,
      status: domainData.status,
      expirationDate: domainData.expirationDate,
      creationDate: domainData.creationDate,
      type: "dynadot::Domain",
    };
  }
);

/**
 * Type guard for Domain resource
 */
export function isDomain(resource: any): resource is Domain {
  return resource?.[ResourceKind] === "dynadot::Domain";
}
