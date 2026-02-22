import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { Network } from "../../src/hetzner/network.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner Network", () => {
  test("create network and attach server", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-net-test-${stableSuffix}`;
    let net: Network;
    let server: Server;

    try {
      // 1. Create Network with subnet
      net = await Network(`${baseName}-priv`, {
        ipRange: "10.0.0.0/16",
        subnets: [
          {
            type: "cloud",
            network_zone: "eu-central",
            ip_range: "10.0.1.0/24",
          },
        ],
        labels: { layer: "private" },
      });

      expect(net.id).toBeDefined();
      expect(net.ipRange).toBe("10.0.0.0/16");
      expect(net.subnets).toHaveLength(1);
      expect(net.subnets[0].ip_range).toBe("10.0.1.0/24");

      // 2. Create Server attached to the network
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        networks: [net],
      });

      expect(server.networks).toContain(net.id);
      const privateIp = server.privateIps[net.id];
      expect(privateIp).toBeDefined();

      // 3. Update Network: add a route using server IP as gateway
      net = await Network(`${baseName}-priv`, {
        ipRange: "10.0.0.0/16",
        subnets: [
          {
            type: "cloud",
            network_zone: "eu-central",
            ip_range: "10.0.1.0/24",
          },
        ],
        routes: [{ destination: "10.100.1.0/24", gateway: privateIp }],
        labels: { layer: "private", updated: "true" },
      });

      expect(net.routes).toHaveLength(1);
      expect(net.routes[0].destination).toBe("10.100.1.0/24");
      expect(net.routes[0].gateway).toBe(privateIp);

      // 4. Verify via API
      const { network: apiNet } = await api.get<{
        network: { labels: Record<string, string> };
      }>(`/networks/${net.id}`);
      expect(apiNet.subnets).toHaveLength(1);
      expect(apiNet.routes).toHaveLength(1);
      expect(apiNet.labels.updated).toBe("true");
    } finally {
      await destroy(scope);
    }
  }, 300000);
});
