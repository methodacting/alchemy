import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { PlacementGroup } from "../../src/hetzner/placement-group.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner PlacementGroup", () => {
  test("create, update labels, and use in server", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-pg-${stableSuffix}`;
    let pg: PlacementGroup;
    let server: Server;

    try {
      // 1. Create Placement Group
      pg = await PlacementGroup(`${baseName}-pg`, {
        type: "spread",
        labels: { project: "alchemy" },
      });

      expect(pg.id).toBeDefined();
      expect(pg.placementGroupType).toBe("spread");
      expect(pg.labels).toEqual({ project: "alchemy" });

      // 2. Update Labels
      pg = await PlacementGroup(`${baseName}-pg`, {
        type: "spread",
        labels: { project: "alchemy-v2" },
      });

      expect(pg.labels).toEqual({ project: "alchemy-v2" });

      // 3. Use in Server
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        placementGroup: pg,
      });

      expect(server.placementGroup).toBe(pg.id);

      // Verify via API
      const { placement_group: apiPg } = await api.get<{
        placement_group: { name: string };
      }>(`/placement_groups/${pg.id}`);
      expect(apiPg.labels).toEqual({ project: "alchemy-v2" });
      expect(apiPg.servers).toContain(parseInt(server.id));
    } finally {
      await destroy(scope);
    }
  }, 300000);
});
