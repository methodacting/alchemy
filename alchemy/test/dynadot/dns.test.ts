import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/dynadot/domain.ts";
import { DNSRecord } from "../../src/dynadot/dns-record.ts";
import { createDynadotApi } from "../../src/dynadot/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createDynadotApi({ sandbox: true });

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Dynadot DNS", () => {
  test("create, update, and delete dns record in sandbox", async (scope) => {
    if (!process.env.DYNADOT_API_KEY || !process.env.DYNADOT_API_SECRET) {
      console.warn("Skipping Dynadot tests: API keys not set");
      return;
    }

    const domainName = `alchemy-dns-test-${Date.now()}.com`;
    let record: any;

    try {
      // 1. Register domain in sandbox
      const domain = await Domain("main", {
        domainName,
        duration: 1,
        sandbox: true,
      });

      // 2. Create A Record
      record = await DNSRecord("test-a", {
        domain,
        host: "www",
        type: "A",
        value: "1.2.3.4",
        sandbox: true,
      });

      expect(record.id).toBe("www/A");
      expect(record.value).toBe("1.2.3.4");

      // 3. Update Record
      record = await DNSRecord("test-a", {
        domain,
        host: "www",
        type: "A",
        value: "5.6.7.8",
        sandbox: true,
      });

      expect(record.value).toBe("5.6.7.8");

      // Verify via API
      const response = await api.get<{ dnsSettings: any[] }>(`/domains/${domainName}/get_dns`);
      const apiRecord = response.dnsSettings.find(r => r.host === "www" && r.type === "A");
      expect(apiRecord.value).toBe("5.6.7.8");

    } finally {
      await destroy(scope);
    }
  }, 180000);
});
