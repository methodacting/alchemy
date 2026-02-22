import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Server } from "../../src/hetzner/server.ts";
import { SSHKey } from "../../src/hetzner/ssh-key.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner SSHKey", () => {
  test("create, update labels, and use in server", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-ssh-test-${stableSuffix}`;
    const dummyPublicKey =
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJK97S9V9X..." + stableSuffix; // Ensure uniqueness if needed, though name is usually enough
    // Actually publicKey must be valid format.
    const validDummyKey =
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFp2oxZ66idmUnY+SIsZIDpS0TdkZqS6Id6SIsZIDpS0 user@host";

    let key: SSHKey;
    let server: Server;

    try {
      // 1. Create SSH Key
      key = await SSHKey(`${baseName}-key`, {
        publicKey: validDummyKey,
        labels: { project: "alchemy" },
      });

      expect(key.id).toBeDefined();
      expect(key.publicKey).toBe(validDummyKey);
      expect(key.fingerprint).toBeDefined();
      expect(key.labels).toEqual({ project: "alchemy" });

      // 2. Update SSH Key Labels
      key = await SSHKey(`${baseName}-key`, {
        publicKey: validDummyKey,
        labels: { project: "alchemy-v2" },
      });

      expect(key.labels).toEqual({ project: "alchemy-v2" });

      // 3. Use in Server
      server = await Server(`${baseName}-srv`, {
        serverType: "cx23",
        image: "ubuntu-24.04",
        location: "hel1",
        sshKeys: [key],
      });

      expect(server.sshKeys).toContain(key.id);

      // Verify via API
      const { ssh_key: apiKey } = await api.get<{ ssh_key: { name: string } }>(
        `/ssh_keys/${key.id}`,
      );
      expect(apiKey.labels).toEqual({ project: "alchemy-v2" });
    } finally {
      await destroy(scope);
    }
  }, 300000);
});
