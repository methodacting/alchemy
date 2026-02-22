import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Certificate } from "../../src/hetzner/certificate.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";

import "../../src/test/vitest.ts";
import { execSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

const stableSuffix =
  BRANCH_PREFIX.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "alchemy";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner Certificate", () => {
  test("create and delete uploaded certificate", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    const api = createHetznerApi();

    const baseName = `${BRANCH_PREFIX}-cert-test-${stableSuffix}`;

    // Generate self-signed certificate
    const keyPath = `./${baseName}-key.pem`;
    const certPath = `./${baseName}-cert.pem`;
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout ${keyPath} -out ${certPath} -days 1 -nodes -subj "/CN=test.run.actor"`,
        { stdio: "ignore" },
      );
      const privateKey = readFileSync(keyPath, "utf-8");
      const certificate = readFileSync(certPath, "utf-8");

      let cert: Certificate;

      try {
        // 1. Create Uploaded Certificate
        cert = await Certificate(`${baseName}-upload`, {
          type: "uploaded",
          certificate,
          privateKey: alchemy.secret(privateKey),
          labels: { test: "true" },
        });

        expect(cert.id).toBeDefined();
        expect(cert.certificateType).toBe("uploaded");
        expect(cert.fingerprint).toBeDefined();
        expect(cert.labels).toEqual({ test: "true" });

        // 2. Update Labels
        cert = await Certificate(`${baseName}-upload`, {
          type: "uploaded",
          certificate,
          privateKey: alchemy.secret(privateKey),
          labels: { test: "updated" },
        });

        expect(cert.labels).toEqual({ test: "updated" });

        // Verify via API
        const { certificate: apiCert } = await api.get<{
          certificate: { labels: Record<string, string> };
        }>(`/certificates/${cert.id}`);
        expect(apiCert.labels).toEqual({ test: "updated" });
      } finally {
        await destroy(scope);
      }
    } finally {
      try {
        rmSync(keyPath);
      } catch {}
      try {
        rmSync(certPath);
      } catch {}
    }
  }, 300000);

  // Managed test is commented out to avoid Let's Encrypt rate limits
  /*
  test("create managed certificate", async (scope) => {
    const baseName = `${BRANCH_PREFIX}-managed-${stableSuffix}`;
    const domain = `${baseName}.run.actor`;
    
    try {
      const cert = await Certificate(`${baseName}-managed`, {
        type: "managed",
        domainNames: [domain]
      });
      
      expect(cert.id).toBeDefined();
      expect(cert.type).toBe("managed");
      expect(cert.domainNames).toContain(domain);
    } finally {
      await destroy(scope);
    }
  }, 600000);
  */
});
