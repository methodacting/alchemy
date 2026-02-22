import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/dynadot/domain.ts";
import { DNSRecord } from "../../src/dynadot/dns-record.ts";
import { createDynadotApi } from "../../src/dynadot/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import type { DynadotV3NameServerSettings } from "../../src/dynadot/types.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

interface GetDnsResponse {
  GetDns: {
    NameServerSettings: DynadotV3NameServerSettings;
  };
}

describe("Dynadot DNS", () => {
  test("create, update, and delete dns record in sandbox", async (scope) => {
    if (!process.env.DYNADOT_API_KEY) {
      console.warn("Skipping Dynadot tests: DYNADOT_API_KEY not set");
      return;
    }

    const api = createDynadotApi({ sandbox: true });
    const domainName = `alchemy-dns-test-${Date.now()}.com`;
    let record: DNSRecord;

    try {
      // 1. Register domain in sandbox
      const domain = await Domain("main", {
        domainName,
        duration: 1,
        sandbox: true,
      });

      // 2. Create Root A Record (Mandatory for Dynadot to have at least one main record)
      await DNSRecord("root-a", {
        domain,
        host: "@",
        dnsType: "A",
        value: "1.1.1.1",
        sandbox: true,
      });

      // 3. Create Subdomain A Record
      record = await DNSRecord("test-a", {
        domain,
        host: "www",
        dnsType: "A",
        value: "1.2.3.4",
        sandbox: true,
      });

      expect(record.id).toBe("www/A");
      expect(record.value).toBe("1.2.3.4");

      // 4. Update Record
      record = await DNSRecord("test-a", {
        domain,
        host: "www",
        dnsType: "A",
        value: "5.6.7.8",
        sandbox: true,
      });

      expect(record.value).toBe("5.6.7.8");

      // Verify via API (with retry for propagation)
      let apiValue: string | undefined;
      let attempts = 0;
      while (attempts < 5) {
        const response = await api.get<GetDnsResponse>("get_dns", {
          domain: domainName,
        });
        const subList = response.GetDns?.NameServerSettings?.SubDomains || [];
        const apiRecord = subList.find(
          (r) =>
            (r.Subhost === "www" || r.SubHost === "www") &&
            r.RecordType.toLowerCase() === "a",
        );
        apiValue = apiRecord?.Value;
        if (apiValue === "5.6.7.8") break;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      }
      expect(apiValue).toBe("5.6.7.8");
    } finally {
      await destroy(scope);
    }
  }, 180000);
});
