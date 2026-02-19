import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { DNSZone } from "../../src/hetzner/dns-zone.ts";
import { DNSRecord } from "../../src/hetzner/dns-record.ts";
import { createHetznerApi } from "../../src/hetzner/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createHetznerApi();

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Hetzner DNS", () => {
  test("create zone and records", async (scope) => {
    if (!process.env.HCLOUD_TOKEN) {
      console.warn("Skipping Hetzner tests: HCLOUD_TOKEN not set");
      return;
    }

    // Use a random test domain
    const domainName = `${BRANCH_PREFIX}-${Date.now()}.com`;
    let zone: any;
    let record: any;

    try {
      // 1. Create Zone
      zone = await DNSZone("test-zone", {
        name: domainName,
        ttl: 3600,
        labels: { test: "true" }
      });

      expect(zone.id).toBeDefined();
      expect(zone.name).toBe(domainName);
      expect(zone.nameservers).toHaveLength(3);

      // 2. Create A Record
      record = await DNSRecord("a-record", {
        zone,
        name: "www",
        type: "A",
        value: "1.2.3.4"
      });

      expect(record.id).toBe("www/A");
      expect(record.value).toEqual(["1.2.3.4"]);

      // 3. Update Record (change value)
      record = await DNSRecord("a-record", {
        zone,
        name: "www",
        type: "A",
        value: ["1.2.3.4", "5.6.7.8"]
      });

      expect(record.value).toEqual(["1.2.3.4", "5.6.7.8"]);

      // Verify via API
      const { rrset } = await api.get<{ rrset: any }>(`/zones/${zone.id}/rrsets/www/A`);
      expect(rrset.records.map((r: any) => r.value)).toContain("5.6.7.8");

    } finally {
      await destroy(scope);
    }
  }, 300000);
});
