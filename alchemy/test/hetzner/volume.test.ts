import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { Volume } from "../../src/hetzner/volume.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createHetznerApi();

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner Volume", () => {
  test("create, resize, attach, and delete volume", async (scope) => {
    // Only run if token is present
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const baseName = `${BRANCH_PREFIX}-test-${Date.now()}`;
    let server: any;
    let volume: any;

    try {
      // 1. Create Server
      server = await Server(`${baseName}-server`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
      });

      // 2. Create Volume (detached)
      volume = await Volume(`${baseName}-volume`, {
        size: 10, // Min size
        location: "hel1",
        format: "ext4",
        labels: { role: "data" }
      });

      expect(volume.id).toBeDefined();
      expect(volume.size).toBe(10);
      expect(volume.location).toBe("hel1");
      expect(volume.server).toBeUndefined();

      // 3. Attach Volume to Server
      volume = await Volume(`${baseName}-volume`, {
        size: 10,
        location: "hel1",
        format: "ext4",
        labels: { role: "data" },
        server: server.id,
        automount: true
      });

      expect(volume.server).toBe(server.id);

      // 4. Resize Volume (Increase)
      volume = await Volume(`${baseName}-volume`, {
        size: 11,
        location: "hel1",
        format: "ext4",
        labels: { role: "data" },
        server: server.id,
        automount: true
      });

      expect(volume.size).toBe(11);

      // 5. Verify Resize via API
      const { volume: apiVolume } = await api.get<{ volume: any }>(`/volumes/${volume.id}`);
      expect(apiVolume.size).toBe(11);

      // 6. Fail on decrease
      try {
        await Volume(`${baseName}-volume`, {
            size: 10,
            location: "hel1",
            format: "ext4",
            server: server.id
        });
        throw new Error("Should have failed");
      } catch (e: any) {
        expect(e.message).toContain("Cannot decrease volume size");
      }

    } finally {
      await destroy(scope);
    }
  }, 300000); // 5 min timeout
});
