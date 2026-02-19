/**
 * Dynadot DNS Record
 */
export interface DynadotDNSSettings {
  type: string;
  host: string;
  value: string;
  ttl?: number;
}

/**
 * Dynadot Domain Details
 */
export interface DynadotDomainDetails {
  domainName: string;
  expirationDate: string;
  creationDate: string;
  status: string;
  whoisPrivacy: "on" | "off";
  autoRenew: "on" | "off";
  nameservers?: string[];
}

/**
 * Dynadot Search Result
 */
export interface DynadotSearchResult {
  available: "yes" | "no";
  price?: string;
  currency?: string;
}
