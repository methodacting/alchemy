import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createHetznerApi();

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
  password: "test-password"
});

describe("Hetzner Server", () => {
  test("create, update, and delete server", async (scope) => {
    // Only run if token is present
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const serverName = `${BRANCH_PREFIX}-test-server`;
    let server: any;

    try {
      // 1. Create
      // Use "cx23" (new gen) and "ubuntu-24.04" (standard)
      server = await Server(serverName, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        labels: { env: "test" },
      });

      expect(server.id).toBeDefined();
      expect(server.name).toContain(serverName);
      expect(server.serverType).toBe("cx23");
      expect(server.image).toBe("ubuntu-24.04");
      expect(server.location).toBe("hel1");
      expect(server.labels).toEqual({ env: "test" });
      expect(server.publicIp).toBeDefined();

      // 2. Update (mutable)
      server = await Server(serverName, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        labels: { env: "prod" }, // changed
      });
      
      expect(server.labels).toEqual({ env: "prod" });

      // Verify update via API
      const { server: apiServer } = await api.get<{ server: any }>(`/servers/${server.id}`);
      expect(apiServer.labels).toEqual({ env: "prod" });

    } finally {
      // 3. Destroy
      await destroy(scope);
    }
  }, 120000); // 2 min timeout for cloud ops
});
