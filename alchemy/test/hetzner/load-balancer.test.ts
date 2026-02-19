import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { LoadBalancer } from "../../src/hetzner/load-balancer.ts";
import { Network } from "../../src/hetzner/network.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createHetznerApi();

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner LoadBalancer", () => {
  test("create, update services, and add target", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const baseName = `${BRANCH_PREFIX}-lb-test-${Date.now()}`;
    let server: any;
    let lb: any;
    let net: any;

    try {
      // 1. Create Network (required for private targets)
      net = await Network(`${baseName}-net`, {
        ipRange: "10.0.0.0/16",
        subnets: [
          { type: "cloud", network_zone: "eu-central", ip_range: "10.0.1.0/24" }
        ]
      });

      // 2. Create Server
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        networks: [net]
      });

      // 3. Create Load Balancer in same zone
      lb = await LoadBalancer(`${baseName}-lb`, {
        loadBalancerType: "lb11",
        networkZone: "eu-central",
        network: net,
        services: [
          { protocol: "http", listen_port: 80, destination_port: 80 }
        ],
        targets: [
          { type: "server", server: server, usePrivateIp: true }
        ],
        labels: { project: "alchemy" }
      });

      expect(lb.id).toBeDefined();
      expect(lb.loadBalancerType).toBe("lb11");
      expect(lb.services).toHaveLength(1);
      expect(lb.targets).toHaveLength(1);
      expect(lb.targets[0].server.id).toBe(parseInt(server.id));
      expect(lb.network).toBe(net.id);

      // 4. Update: Add another service and change algorithm
      lb = await LoadBalancer(`${baseName}-lb`, {
        loadBalancerType: "lb11",
        networkZone: "eu-central",
        network: net,
        algorithm: "least_connections",
        services: [
          { protocol: "http", listen_port: 80, destination_port: 80 },
          { protocol: "tcp", listen_port: 443, destination_port: 443 }
        ],
        targets: [
          { type: "server", server: server, usePrivateIp: true }
        ],
        labels: { project: "alchemy" }
      });

      expect(lb.algorithm).toBe("least_connections");
      expect(lb.services).toHaveLength(2);

      // Verify via API
      const { load_balancer: apiLb } = await api.get<{ load_balancer: any }>(`/load_balancers/${lb.id}`);
      expect(apiLb.algorithm.type).toBe("least_connections");
      expect(apiLb.services).toHaveLength(2);
      expect(apiLb.targets).toHaveLength(1);

    } finally {
      await destroy(scope);
    }
  }, 600000); // 10 min timeout for multiple resources
});
