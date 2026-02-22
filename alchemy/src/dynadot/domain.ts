import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createDynadotApi, type DynadotApiOptions } from "./api.ts";
import type { DynadotDomainDetails, DynadotV3DomainInfo } from "./types.ts";

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

export type Domain = Omit<
  DomainProps,
  "adopt" | "token" | "apiKey" | "apiSecret"
> &
  Resource<"dynadot::Domain"> & {
    id: string;
    status: string;
    expirationDate: string;
    creationDate: string;
    type: "dynadot::Domain";
  };

interface DomainInfoCommandResponse {
  DomainInfo: DynadotV3DomainInfo;
}

/**
 * Helper to map raw Dynadot V3 API response to our internal details type
 */
function mapRawToDetails(raw: DynadotV3DomainInfo): DynadotDomainDetails {
  return {
    domainName: raw.Name,
    status: raw.Status,
    expirationDate: raw.Expiration,
    creationDate: raw.Registration,
    autoRenew: raw.RenewOption === "auto" ? "on" : "off",
    whoisPrivacy:
      raw.Privacy === "full" || raw.Privacy === "partial" ? "on" : "off",
    nameservers: raw.NameServerSettings?.NameServers?.map((ns) =>
      typeof ns === "string" ? ns : (ns as { ServerName: string }).ServerName,
    ),
  };
}

/**
 * Manages a Dynadot Domain registration and settings.
 */
export const Domain = Resource(
  "dynadot::Domain",
  async function (
    this: Context<Domain>,
    _id: string,
    props: DomainProps,
  ): Promise<Domain> {
    const api = createDynadotApi(props);
    const domainName = props.domainName;

    if (
      this.phase === "update" &&
      this.output &&
      this.output.domainName !== domainName
    ) {
      return this.replace();
    }

    // Deletion is a NOOP for domains
    if (this.phase === "delete") {
      return this.destroy();
    }

    let domainData: DynadotDomainDetails | undefined;

    if (this.phase === "create" || !this.output) {
      // Check if domain is already in account
      try {
        const response = await api.get<DomainInfoCommandResponse>(
          "domain_info",
          { domain: domainName },
        );
        if (response.DomainInfo) {
          domainData = mapRawToDetails(response.DomainInfo);
        }
      } catch (e) {
        /* ignore */
      }

      if (domainData) {
        if (!props.adopt && !this.isReplacement) {
          throw new Error(
            `Domain "${domainName}" already exists in your Dynadot account. Use adopt: true to manage it.`,
          );
        }
      } else {
        // Register domain
        await api.post<{}>("register", {
          domain: domainName,
          duration: props.duration ?? 1,
          currency: "USD",
        });

        // Wait and fetch info (registration can take a few moments)
        let attempts = 0;
        while (attempts < 10) {
          try {
            const info = await api.get<DomainInfoCommandResponse>(
              "domain_info",
              { domain: domainName },
            );
            if (info.DomainInfo) {
              domainData = mapRawToDetails(info.DomainInfo);
              break;
            }
          } catch (e) {
            if (attempts === 9) throw e;
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
          attempts++;
        }
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
        await api.post<{}>("set_renew_option", {
          domain: domainName,
          renew_option: props.autoRenew ? "auto" : "donot",
        });
      }
    }

    if (props.whoisPrivacy !== undefined) {
      const currentPrivacy = domainData.whoisPrivacy === "on";
      if (currentPrivacy !== props.whoisPrivacy) {
        await api.post<{}>("set_privacy", {
          domain: domainName,
          option: props.whoisPrivacy ? "full" : "off",
          whois_privacy_option: props.whoisPrivacy ? "yes" : "no",
        });
      }
    }

    if (props.nameservers && props.nameservers.length > 0) {
      const nsParams: Record<string, string> = { domain: domainName };
      props.nameservers.forEach((ns, index) => {
        nsParams[`ns${index}`] = ns;
      });
      await api.post<{}>("set_ns", nsParams);
    }

    return {
      id: domainName,
      domainName: domainName,
      autoRenew: props.autoRenew ?? domainData.autoRenew === "on",
      whoisPrivacy: props.whoisPrivacy ?? domainData.whoisPrivacy === "on",
      nameservers: props.nameservers,
      status: domainData.status,
      expirationDate: domainData.expirationDate,
      creationDate: domainData.creationDate,
      type: "dynadot::Domain",
    } as Domain;
  },
);

/**
 * Type guard for Domain resource
 */
export function isDomain(resource: unknown): resource is Domain {
  return (resource as any)?.[ResourceKind] === "dynadot::Domain";
}
