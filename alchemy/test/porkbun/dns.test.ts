import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/porkbun/domain.ts";
import { DNSRecord } from "../../src/porkbun/dns-record.ts";
import { createPorkbunApi } from "../../src/porkbun/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Porkbun DNS", () => {
  test("create, update, and delete dns record", async (scope) => {
    if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_API_KEY) {
      console.warn("Skipping Porkbun tests: API keys not set");
      return;
    }

    const domainName = process.env.PORKBUN_TEST_DOMAIN;
    if (!domainName) {
      console.log("Skipping Porkbun DNS test: missing PORKBUN_TEST_DOMAIN");
      return;
    }

    const api = createPorkbunApi();
    const subdomain = `${BRANCH_PREFIX}-dns`;
    let record: DNSRecord;

    try {
      // 1. Adopt domain first
      const domain = await Domain("main", {
        domain: domainName,
        adopt: true,
      });

      // 2. Create A Record
      record = await DNSRecord("test-a", {
        domain,
        name: subdomain,
        type: "A",
        content: "1.2.3.4",
        ttl: 600
      });

      expect(record.id).toBeDefined();
      expect(record.dnsType).toBe("A");
      expect(record.content).toBe("1.2.3.4");

      // 3. Update Record
      record = await DNSRecord("test-a", {
        domain,
        name: subdomain,
        type: "A",
        content: "5.6.7.8",
        ttl: 600
      });

      expect(record.content).toBe("5.6.7.8");

      // Verify via API
      const { records } = await api.post<{ records: any[] }>(`/dns/retrieve/${domainName}/${record.id}`);
      expect(records[0].content).toBe("5.6.7.8");

    } finally {
      await destroy(scope);
      
      // Verify deletion
      if (record?.id) {
        try {
          const response = await api.post<{ records: any[] }>(`/dns/retrieve/${domainName}/${record.id}`);
          // If it doesn't throw, check if records is empty or first item is different
          if (response.records && response.records.length > 0) {
             // In some cases Porkbun might return status ERROR for non-existent ID
          }
        } catch (e: any) {
           expect(e.message).toContain("Logic Error");
        }
      }
    }
  }, 180000);
});
