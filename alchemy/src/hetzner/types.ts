/**
 * Hetzner Cloud Server Types
 * @see https://docs.hetzner.cloud/#server-types-get-all-server-types
 */
export type HetznerServerType =
  // Standard (Intel/AMD)
  | "cx22"
  | "cx32"
  | "cx42"
  | "cx52"
  | "cx23"
  | "cx33"
  | "cx43"
  | "cx53"
  // Shared vCPU (Intel/AMD)
  | "cpx11"
  | "cpx21"
  | "cpx31"
  | "cpx41"
  | "cpx51"
  | "cpx12"
  | "cpx22"
  | "cpx32"
  | "cpx42"
  | "cpx52"
  | "cpx62"
  // Arm64
  | "cax11"
  | "cax21"
  | "cax31"
  | "cax41"
  // Dedicated vCPU
  | "ccx13"
  | "ccx23"
  | "ccx33"
  | "ccx43"
  | "ccx53"
  | "ccx63"
  // Fallback for new types
  | (string & {});

/**
 * Hetzner Cloud Images
 * @see https://docs.hetzner.cloud/#images-get-all-images
 */
export type HetznerImage =
  | "ubuntu-24.04"
  | "ubuntu-22.04"
  | "debian-12"
  | "debian-11"
  | "fedora-43"
  | "fedora-42"
  | "fedora-41"
  | "centos-stream-9"
  | "alma-9"
  | "rocky-9"
  | "opensuse-15"
  // Fallback for snapshots, backups, or new images
  | (string & {});

/**
 * Hetzner Cloud Locations
 * @see https://docs.hetzner.cloud/#locations-get-all-locations
 */
export type HetznerLocation =
  | "nbg1" // Nuremberg
  | "fsn1" // Falkenstein
  | "hel1" // Helsinki
  | "ash"  // Ashburn, VA
  | "hil"  // Hillsboro, OR
  | "sin"  // Singapore
  // Fallback
  | (string & {});

/**
 * Hetzner Cloud Volume Formats
 * @see https://docs.hetzner.cloud/#volumes-create-a-volume
 */
export type HetznerVolumeFormat = "xfs" | "ext4" | (string & {});

/**
 * Hetzner Cloud Firewall Rule
 * @see https://docs.hetzner.cloud/#firewalls-create-a-firewall
 */
export interface HetznerFirewallRule {
  /** Protocol of the rule */
  protocol: "tcp" | "udp" | "icmp" | "esp" | "gre";
  /** Direction of the rule */
  direction: "in" | "out";
  /** Port range (e.g. "80", "80-443") */
  port?: string;
  /** List of source CIDRs (for "in" rules) */
  source_ips?: string[];
  /** List of destination CIDRs (for "out" rules) */
  destination_ips?: string[];
  /** Description of the rule */
  description?: string;
}

/**
 * Hetzner Cloud Network Zone
 */
export type HetznerNetworkZone =
  | "eu-central"
  | "us-east"
  | "us-west"
  | "ap-southeast"
  | (string & {});

/**
 * Hetzner Cloud Subnet
 */
export interface HetznerSubnet {
  /** Type of subnet */
  type: "cloud" | "vswitch";
  /** Network zone */
  network_zone: HetznerNetworkZone;
  /** IP range in CIDR notation */
  ip_range?: string;
  /** vSwitch ID (only for type vswitch) */
  vswitch_id?: number;
}

/**
 * Hetzner Cloud Route
 */
export interface HetznerRoute {
  /** Destination network in CIDR notation */
  destination: string;
  /** Gateway IP address */
  gateway: string;
}

/**
 * Hetzner Cloud Load Balancer Types
 */
export type HetznerLoadBalancerType = "lb11" | "lb21" | "lb31" | (string & {});

/**
 * Hetzner Cloud Load Balancer Algorithm
 */
export type HetznerLoadBalancerAlgorithm = "round_robin" | "least_connections";

/**
 * Hetzner Cloud Load Balancer Service
 */
export interface HetznerLoadBalancerService {
  /** Protocol of the service */
  protocol: "tcp" | "http" | "https";
  /** Port the Load Balancer listens on */
  listen_port: number;
  /** Port the Load Balancer connects to on the targets */
  destination_port: number;
  /** Whether to enable proxy protocol */
  proxyprotocol?: boolean;
  /** Service health check configuration */
  health_check?: {
    protocol: "tcp" | "http";
    port: number;
    interval: number;
    timeout: number;
    retries: number;
    http?: {
      domain?: string;
      path?: string;
      response?: string;
      tls?: boolean;
      status_codes?: string[];
    };
  };
  /** HTTP configuration (only for protocol http/https) */
  http?: {
    cookie_name?: string;
    cookie_lifetime?: number;
    certificates?: number[];
    sticky_sessions?: boolean;
    redirect_http?: boolean;
  };
}

/**
 * Hetzner Cloud Load Balancer Target
 */
export interface HetznerLoadBalancerTarget {
  /** Type of target */
  type: "server" | "label_selector" | "ip";
  /** Server information (type server) */
  server?: {
    id: number;
  };
  /** Label selector information (type label_selector) */
  label_selector?: {
    selector: string;
  };
  /** IP information (type ip) */
  ip?: {
    ip: string;
  };
  /** Whether to use the private IP for this target */
  use_private_ip?: boolean;
}

/**
 * Hetzner Cloud Firewall Resource Attachment
 */
export interface HetznerFirewallResource {
  /** Type of resource */
  type: "server" | "label_selector";
  /** Server information */
  server?: {
    id: number;
  };
  /** Label selector information */
  label_selector?: {
    selector: string;
  };
}

/**
 * Hetzner Cloud DNS Record (individual entry in an RRSet)
 */
export interface HetznerDNSRecord {
  /** Value of the record */
  value: string;
  /** Optional comment */
  comment?: string;
}

/**
 * Hetzner Cloud DNS RRSet (Resource Record Set)
 */
export interface HetznerRRSet {
  /** ID of the RRSet (format: name/type) */
  id: string;
  /** Name of the RRSet (@ or relative name) */
  name: string;
  /** DNS Type (A, AAAA, CNAME, etc.) */
  type: string;
  /** TTL for this RRSet */
  ttl: number | null;
  /** Labels */
  labels: Record<string, string>;
  /** Individual record entries */
  records: HetznerDNSRecord[];
  /** Parent zone ID */
  zone: number;
}

/**
 * Hetzner Cloud Certificate Type
 */
export type HetznerCertificateType = "uploaded" | "managed";

/**
 * Hetzner Cloud Certificate Status
 */
export interface HetznerCertificateStatus {
  /** Type of error */
  error?: {
    code: string;
    message: string;
  };
  /** Status of the certificate issuing process */
  issuance: "pending" | "completed" | "failed";
  /** Renewal status */
  renewal: "scheduled" | "pending" | "completed" | "failed" | "unavailable";
}

/**
 * Hetzner Cloud Floating IP Type
 */
export type HetznerFloatingIPType = "ipv4" | "ipv6";

/**
 * Hetzner Cloud Storage Box Type
 */
export type HetznerStorageBoxType = "bx11" | "bx21" | "bx31" | "bx41" | (string & {});

/**
 * Hetzner Cloud Storage Box Access Settings
 */
export interface HetznerStorageBoxAccessSettings {
  /** Whether the Storage Box is reachable externally */
  reachable_externally?: boolean;
  /** Whether Samba is enabled */
  samba_enabled?: boolean;
  /** Whether SSH is enabled */
  ssh_enabled?: boolean;
  /** Whether WebDAV is enabled */
  webdav_enabled?: boolean;
  /** Whether ZFS is enabled */
  zfs_enabled?: boolean;
}

