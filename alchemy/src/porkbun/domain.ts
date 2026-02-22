import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { createPorkbunApi, type PorkbunApiOptions } from "./api.ts";
import type { PorkbunDomainDetails } from "./types.ts";

export interface DomainProps extends PorkbunApiOptions {
  /**
   * The domain name to manage (e.g. "example.com")
   */
  domain: string;

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
   * Maximum allowed cost in USD for registration
   * Fails if price exceeds this.
   */
  maxCost?: number;

  /**
   * Must be set to true to acknowledge terms for registration
   */
  agreeToTerms?: boolean;

  /**
   * Whether to adopt an existing domain
   * @default false
   */
  adopt?: boolean;
}

export type Domain = Omit<
  DomainProps,
  "adopt" | "token" | "apiKey" | "secretApiKey" | "agreeToTerms"
> & {
  id: string;
  status: string;
  expireDate: string;
  createDate: string;
  type: "porkbun::Domain";
};

/**
 * Manages a Porkbun Domain registration and settings.
 *
 * @example
 * const domain = await Domain("main", {
 *   domain: "run.actor",
 *   adopt: true,
 *   autoRenew: true
 * });
 */
export const Domain = Resource(
  "porkbun::Domain",
  async function (
    this: Context<Domain>,
    id: string,
    props: DomainProps,
  ): Promise<Domain> {
    const api = createPorkbunApi(props);
    const domainName = props.domain;

    // Deletion is a NOOP for domains to prevent accidental loss
    if (this.phase === "delete") {
      return this.destroy();
    }

    let domainData: PorkbunDomainDetails | undefined;

    if (this.phase === "create" || !this.output) {
      // Check if domain is already in account
      try {
        const { domains } = await api.post<{ domains: PorkbunDomainDetails[] }>(
          "/domain/listAll",
        );
        domainData = domains.find((d) => d.domain === domainName);
      } catch (e) {
        /* ignore */
      }

      if (domainData) {
        if (!props.adopt && !this.isReplacement) {
          throw new Error(
            `Domain "${domainName}" already exists in your Porkbun account. Use adopt: true to manage it.`,
          );
        }
      } else {
        // Register domain
        if (!props.agreeToTerms) {
          throw new Error(
            `agreeToTerms must be true to register domain "${domainName}"`,
          );
        }

        // Check pricing first
        const { pricing } = await api.post<{ pricing: Record<string, any> }>(
          "/pricing/get",
        );
        const tld = domainName.split(".").pop()!;
        const cost = pricing[tld]?.registration;

        if (
          props.maxCost !== undefined &&
          cost &&
          parseFloat(cost) > props.maxCost
        ) {
          throw new Error(
            `Registration cost for "${domainName}" ($${cost}) exceeds maxCost ($${props.maxCost})`,
          );
        }

        // Convert cost to pennies for API
        const costPennies = cost ? Math.round(parseFloat(cost) * 100) : 0;

        await api.post(`/domain/create/${domainName}`, {
          cost: costPennies,
          agreeToTerms: "yes",
        });

        // Fetch details after creation
        const { domains } = await api.post<{ domains: PorkbunDomainDetails[] }>(
          "/domain/listAll",
        );
        domainData = domains.find((d) => d.domain === domainName);
      }
    } else {
      // Update mutable properties
      domainData = {
        domain: this.output.domain,
        status: this.output.status,
        expireDate: this.output.expireDate,
        createDate: this.output.createDate,
        autoRenew: this.output.autoRenew ? "1" : "0",
        whoisPrivacy: this.output.whoisPrivacy ? "1" : "0",
      };
    }

    if (!domainData) {
      throw new Error(`Failed to find domain "${domainName}" in account`);
    }

    // Sync settings
    if (props.autoRenew !== undefined) {
      const currentAutoRenew = domainData.autoRenew === "1";
      if (currentAutoRenew !== props.autoRenew) {
        await api.post(`/domain/updateAutoRenew/${domainName}`, {
          status: props.autoRenew ? "on" : "off",
        });
      }
    }

    if (props.nameservers) {
      const { ns } = await api.post<{ ns: string[] }>(
        `/domain/getNs/${domainName}`,
      );
      if (
        JSON.stringify(ns.sort()) !== JSON.stringify(props.nameservers.sort())
      ) {
        await api.post(`/domain/updateNs/${domainName}`, {
          ns: props.nameservers,
        });
      }
    }

    return {
      id: domainName,
      domain: domainName,
      autoRenew: props.autoRenew ?? domainData.autoRenew.toString() === "1",
      whoisPrivacy:
        props.whoisPrivacy ?? domainData.whoisPrivacy.toString() === "1",
      nameservers: props.nameservers,
      status: domainData.status,
      expireDate: domainData.expireDate,
      createDate: domainData.createDate,
      type: "porkbun::Domain",
    };
  },
);

/**
 * Type guard for Domain resource
 */
export function isDomain(resource: unknown): resource is Domain {
  return (resource as any)?.[ResourceKind] === "porkbun::Domain";
}
