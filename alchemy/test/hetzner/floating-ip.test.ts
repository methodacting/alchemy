import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { FloatingIP } from "../../src/hetzner/floating-ip.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner FloatingIP", () => {
  test("create, assign, and delete floating ip", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-fip-${stableSuffix}`;
    let server: Server;
    let fip: FloatingIP;

    try {
      // 1. Create Server
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
      });

      // 2. Create Floating IP unassigned
      fip = await FloatingIP(`${baseName}-ip`, {
        type: "ipv4",
        homeLocation: "hel1",
        labels: { test: "true" },
      });

      expect(fip.id).toBeDefined();
      expect(fip.ip).toBeDefined();
      expect(fip.server).toBeUndefined();

      // 3. Assign to Server
      fip = await FloatingIP(`${baseName}-ip`, {
        type: "ipv4",
        homeLocation: "hel1",
        server: server,
        labels: { test: "true" },
      });

      expect(fip.server).toBe(server.id);

      // Verify via API
      const { floating_ip: apiFip } = await api.get<{
        floating_ip: { server: number | null };
      }>(`/floating_ips/${fip.id}`);
      expect(apiFip.server).toBe(parseInt(server.id));

      // 4. Unassign
      fip = await FloatingIP(`${baseName}-ip`, {
        type: "ipv4",
        homeLocation: "hel1",
        labels: { test: "true" },
      });

      expect(fip.server).toBeUndefined();
    } finally {
      await destroy(scope);
    }
  }, 300000);
});
