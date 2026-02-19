import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { StorageBox } from "../../src/hetzner/storage-box.ts";
import { StorageBoxSubaccount } from "../../src/hetzner/storage-box-subaccount.ts";
import { File } from "../../src/fs/file.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";
import { Secret } from "../../src/secret.ts";
import { withExponentialBackoff } from "../../src/util/retry.ts";

const api = createHetznerApi({}, "robot");

describe("Hetzner StorageBox", () => {
  const test = alchemy.test(import.meta, {
    prefix: BRANCH_PREFIX,
  });

  test("create box, subaccount and functional WebDAV upload", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const baseName = `sb-${Date.now()}`;
    const boxPassword = `AlchemyFunctional!${Date.now()}`;
    let box: any;
    let sub: any;
    let localFile: any;

    try {
      // 1. Create Storage Box
      box = await StorageBox(`${baseName}-box`, {
        location: "fsn1",
        storageBoxType: "bx11",
        password: alchemy.secret(boxPassword),
        accessSettings: {
          webdav_enabled: true,
          reachable_externally: true
        }
      });

      expect(box.id).toBeDefined();
      expect(box.accessSettings.webdav_enabled).toBe(true);

      // 2. Create Subaccount
      sub = await StorageBoxSubaccount(`${baseName}-sub`, {
        box: box,
        homeDirectory: "test-sub",
        password: alchemy.secret("SubPass123!@#"),
        accessSettings: {
          webdav_enabled: true
        }
      });

      expect(sub.id).toBeDefined();
      console.log("Box Username:", box.username);
      console.log("Sub Username:", sub.username);
      expect(sub.username).toContain(box.username);

      // 3. Functional WebDAV Upload using local File resource
      const fileContent = `Alchemy Functional Test ${Date.now()}`;
      localFile = await File(`${baseName}-local.txt`, {
        path: `./${baseName}-upload.txt`,
        content: fileContent
      });

      // Attempt to upload via WebDAV
      // Note: Storage Boxes take a few moments to sync the password to the WebDAV service.
      const uploadUrl = `https://${box.server}/test-upload.txt`;
      const auth = Buffer.from(`${box.username}:${boxPassword}`).toString("base64");

      await withExponentialBackoff(
        async () => {
            const response = await fetch(uploadUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Basic ${auth}`,
                    "Content-Type": "text/plain"
                },
                body: fileContent
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`WebDAV Upload Failed (${response.status}): ${text}`);
            }
        },
        () => true, // Retry on any connection/auth error during propagation
        30,
        5000,
        20000
      );

      // 4. Verify Download
      const getResponse = await fetch(uploadUrl, {
          headers: { "Authorization": `Basic ${auth}` }
      });
      const downloadedContent = await getResponse.text();
      expect(downloadedContent).toBe(fileContent);

    } finally {
      await destroy(scope);
    }
  }, 600000);
});
