# Hetzner Cloud Provider

This provider allows you to manage Hetzner Cloud resources using Alchemy.

## Prerequisites

- **Hetzner Cloud Token**: Set the `HCLOUD_TOKEN` environment variable.

## Resources

### Conditional Deletion

Most resources support a `delete` property. If set to `false`, the resource will be removed from Alchemy's management but will **not** be deleted from Hetzner Cloud. This is useful for preventing accidental data loss on critical resources like Servers, Volumes, or Storage Boxes.

```ts
const criticalServer = await Server("prod-db", {
  // ...
  delete: false
});
```

### Server

Creates a Hetzner Cloud Server (VPS).

```ts
import { Server } from "alchemy/src/hetzner/server.ts";

const webServer = await Server("web-1", {
  serverType: "cx22",
  image: "ubuntu-24.04",
  location: "nbg1",
  labels: {
    role: "web",
    env: "production"
  }
});

console.log(`Server IP: ${webServer.publicIp}`);
```

### Volume

Creates a Hetzner Cloud Volume (Block Storage).

```ts
import { Volume } from "alchemy/src/hetzner/volume.ts";

// Create a 20GB Volume
const dataVolume = await Volume("data-vol", {
  size: 20, // GB
  location: "nbg1",
  format: "xfs",
  labels: {
    role: "data"
  }
});

// Create and attach to a server
const webServer = await Server("web-1", { ... });

const attachedVolume = await Volume("web-vol", {
  size: 10,
  location: "nbg1",
  server: webServer.id,
  automount: true
});
```

### Firewall

Creates a Hetzner Cloud Firewall.

```ts
import { Firewall } from "alchemy/src/hetzner/firewall.ts";

const fw = await Firewall("web-sec", {
  rules: [
    {
      direction: "in",
      protocol: "tcp",
      port: "80",
      source_ips: ["0.0.0.0/0", "::/0"]
    },
    {
      direction: "in",
      protocol: "tcp",
      port: "443",
      source_ips: ["0.0.0.0/0", "::/0"]
    }
  ],
  applyTo: [webServer] // Can apply to Server resource objects
});
```

### Network

Creates a Hetzner Cloud Private Network.

```ts
import { Network } from "alchemy/src/hetzner/network.ts";

const privateNet = await Network("main-net", {
  ipRange: "10.0.0.0/8",
  subnets: [
    { type: "cloud", network_zone: "eu-central", ip_range: "10.0.1.0/24" }
  ]
});

// Attach server to network
const srv = await Server("app-srv", {
  // ...
  networks: [privateNet]
});
```

### SSH Key

Manages Hetzner Cloud SSH Keys.

```ts
import { SSHKey } from "alchemy/src/hetzner/ssh-key.ts";

const myKey = await SSHKey("personal-key", {
  publicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFp2oxZ66idmUnY+SIsZIDpS0TdkZqS6Id6SIsZIDpS0"
});

// Use in server
const srv = await Server("web-1", {
  // ...
  sshKeys: [myKey]
});
```

### Floating IP

Manages Hetzner Cloud Floating IPs.

```ts
import { FloatingIP } from "alchemy/src/hetzner/floating-ip.ts";

const ip = await FloatingIP("web-ip", {
  type: "ipv4",
  homeLocation: "nbg1",
  server: webServer // Assign to server
});

console.log(`Floating IP: ${ip.ip}`);
```


### Load Balancer

Creates a Hetzner Cloud Load Balancer.

```ts
import { LoadBalancer } from "alchemy/src/hetzner/load-balancer.ts";

const lb = await LoadBalancer("web-lb", {
  loadBalancerType: "lb11",
  location: "nbg1",
  algorithm: "round_robin",
  services: [
    { protocol: "http", listen_port: 80, destination_port: 80 }
  ],
  targets: [
    { type: "server", server: srv }
  ]
});

console.log(`LB IP: ${lb.publicIpv4}`);
```

### DNS Zone

Manages a Hetzner Cloud DNS Zone.

```ts
import { DNSZone } from "alchemy/src/hetzner/dns-zone.ts";

const zone = await DNSZone("main", {
  name: "run.actor",
  adopt: true // Adopt existing zone
});
```

### DNS Record

Manages a DNS Resource Record Set (RRSet).

```ts
import { DNSRecord } from "alchemy/src/hetzner/dns-record.ts";

await DNSRecord("web-a-record", {
  zone,
  name: "app",
  type: "A",
  value: webServer.publicIp
});

await DNSRecord("mx-records", {
  zone,
  name: "@",
  type: "MX",
  value: ["10 mail1.example.com.", "20 mail2.example.com."]
});
```

### Storage Box

Manages a Hetzner Cloud Storage Box.

```ts
import { StorageBox } from "alchemy/src/hetzner/storage-box.ts";

const box = await StorageBox("backup", {
  location: "fsn1",
  storageBoxType: "bx11",
  password: alchemy.secret("StrongPassword123!"),
  accessSettings: {
    ssh_enabled: true,
    samba_enabled: true
  }
});

console.log(`Storage Box Host: ${box.server}`);
console.log(`Storage Box User: ${box.username}`);
```






