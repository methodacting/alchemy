/**
 * Dynadot V3 API Header structure
 * @internal
 */
export interface DynadotV3Header {
  ResponseCode: string | number;
  Status: string;
  Error?: string;
}

/**
 * Dynadot V3 Main DNS Record (Root) from API
 * @internal
 */
export interface DynadotV3MainDomain {
  RecordType: string;
  Value: string;
  Value2?: string;
}

/**
 * Dynadot V3 Sub DNS Record (Subdomain) from API
 * @internal
 */
export interface DynadotV3SubDomain {
  Subhost?: string;
  SubHost?: string;
  RecordType: string;
  Value: string;
  Value2?: string;
}

/**
 * Dynadot V3 NameServerSettings from API
 * @internal
 */
export interface DynadotV3NameServerSettings {
  Type: string;
  NameServers?: Array<{ ServerName: string }>;
  MainDomains?: DynadotV3MainDomain[];
  SubDomains?: DynadotV3SubDomain[];
  TTL?: string | number;
}

/**
 * Dynadot V3 Domain Info structure from API
 * @internal
 */
export interface DynadotV3DomainInfo {
  Name: string;
  Expiration: string; // Unix time ms as string
  Registration: string; // Unix time ms as string
  NameServerSettings: DynadotV3NameServerSettings;
  Whois: {
    Registrant: { ContactId: string };
    Admin: { ContactId: string };
    Technical: { ContactId: string };
    Billing: { ContactId: string };
  };
  Locked: "yes" | "no";
  Disabled: "yes" | "no";
  Privacy: string;
  RenewOption: string;
  Status: string;
}

/**
 * Dynadot V3 Command Response wrapper
 * @internal
 */
export interface DynadotV3Response<T> {
  [key: string]: DynadotV3Header & T;
}

/**
 * Dynadot Domain Details (Normalized)
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

/**
 * Internal record representation for normalization
 * @internal
 */
export interface NormalizedRecord {
  host: string;
  type: string;
  value: string;
  value2?: string;
}
