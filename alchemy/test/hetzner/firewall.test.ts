import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { Firewall } from "../../src/hetzner/firewall.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner Firewall", () => {
  test("create, update rules, and apply to server", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-fw-test-${stableSuffix}`;
    let server: Server;
    let fw: Firewall;

    try {
      // 1. Create Firewall with one rule
      fw = await Firewall(`${baseName}-fw`, {
        rules: [
          {
            direction: "in",
            protocol: "tcp",
            port: "80",
            source_ips: ["0.0.0.0/0", "::/0"],
          },
        ],
        labels: { component: "security" },
      });

      expect(fw.id).toBeDefined();
      expect(fw.rules).toHaveLength(1);
      expect(fw.rules[0].port).toBe("80");
      expect(fw.labels).toEqual({ component: "security" });

      // 2. Create Server
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
      });

      // 3. Update Firewall: add rule and apply to server
      fw = await Firewall(`${baseName}-fw`, {
        rules: [
          {
            direction: "in",
            protocol: "tcp",
            port: "80",
            source_ips: ["0.0.0.0/0", "::/0"],
          },
          {
            direction: "in",
            protocol: "tcp",
            port: "443",
            source_ips: ["0.0.0.0/0", "::/0"],
          },
        ],
        applyTo: [server], // Use resource object
        labels: { component: "security" },
      });

      expect(fw.rules).toHaveLength(2);
      expect(fw.appliedTo).toHaveLength(1);
      expect(fw.appliedTo[0].server.id).toBe(parseInt(server.id));

      // 4. Verify via API
      const { firewall: apiFw } = await api.get<{
        firewall: {
          rules: unknown[];
          applied_to: Array<{ server?: { id: number } }>;
        };
      }>(`/firewalls/${fw.id}`);
      expect(apiFw.rules).toHaveLength(2);
      expect(apiFw.applied_to).toHaveLength(1);
      expect(apiFw.applied_to[0].server.id).toBe(parseInt(server.id));
    } finally {
      await destroy(scope);
    }
  }, 300000);
});
