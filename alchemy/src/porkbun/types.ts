/**
 * Porkbun DNS Record
 */
export interface PorkbunDNSRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: string;
  prio: string;
  notes: string;
}

/**
 * Porkbun Domain Pricing
 */
export interface PorkbunPricing {
  registration: string;
  renewal: string;
  transfer: string;
}

/**
 * Porkbun Domain Details
 */
export interface PorkbunDomainDetails {
  domain: string;
  status: string;
  expireDate: string;
  createDate: string;
  autoRenew: "0" | "1";
  whoisPrivacy: "0" | "1";
}
