# Hetzner Cloud

The Hetzner provider allows you to manage virtual infrastructure on Hetzner Cloud and Robot APIs using TypeScript.

[Official Hetzner Website](https://www.hetzner.com/)

## Resources

### Compute
- [Server](./server.md) - Virtual Private Servers (VPS).
- [Placement Group](./placement-group.md) - Scheduling policies for high availability.

### Storage
- [Volume](./volume.md) - Persistent block storage.
- [Storage Box](./storage-box.md) - Large-scale network storage.
- [Storage Box Subaccount](./storage-box-subaccount.md) - Additional storage users.

### Networking
- [Network](./network.md) - Private LAN and subnets.
- [Load Balancer](./load-balancer.md) - L4/L7 traffic distribution.
- [Floating IP](./floating-ip.md) - Dynamic IP reassignment.

### Security
- [Firewall](./firewall.md) - Stateful traffic rules.
- [SSH Key](./ssh-key.md) - Public key authentication.
- [Certificate](./certificate.md) - Managed and uploaded SSL/TLS.

### DNS
- [DNS Zone](./dns-zone.md) - Manage domain zones.
- [DNS Record](./dns-record.md) - Manage resource record sets.

## Example Usage

```ts
import { Server, Network, Firewall } from "alchemy/hetzner";

// Create an isolated network
const net = await Network("private", {
  ipRange: "10.0.0.0/8",
  subnets: [{ type: "cloud", network_zone: "eu-central", ip_range: "10.0.1.0/24" }]
});

// Define security rules
const fw = await Firewall("web-sec", {
  rules: [{ direction: "in", protocol: "tcp", port: "80", source_ips: ["0.0.0.0/0"] }]
});

// Deploy a server into the network and firewall
const srv = await Server("web", {
  serverType: "cx23",
  image: "ubuntu-24.04",
  networks: [net],
  firewalls: [{ firewall: fw.id }]
});
```
