import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/dynadot/domain.ts";
import { createDynadotApi } from "../../src/dynadot/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import type { DynadotV3DomainInfo } from "../../src/dynadot/types.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

interface DomainInfoResponse {
  DomainInfo: DynadotV3DomainInfo;
}

describe("Dynadot Domain", () => {
  test("adopt or register domain in sandbox", async (scope) => {
    if (!process.env.DYNADOT_API_KEY) {
      console.warn("Skipping Dynadot tests: DYNADOT_API_KEY not set");
      return;
    }

    const api = createDynadotApi({ sandbox: true });
    const domainName = `alchemy-test-${Date.now()}.com`;
    let domain: Domain;

    try {
      // 1. Register (in sandbox)
      domain = await Domain("main", {
        domainName,
        duration: 1,
        sandbox: true,
      });

      expect(domain.id).toBe(domainName);
      expect(domain.domainName).toBe(domainName);
      expect(domain.status).toBeDefined();

      // 2. Update settings
      domain = await Domain("main", {
        domainName,
        adopt: true,
        autoRenew: false,
        sandbox: true,
      });

      expect(domain.autoRenew).toBe(false);

      // Verify via API
      const response = await api.get<DomainInfoResponse>("domain_info", {
        domain: domainName,
      });
      const renewOption = response.DomainInfo.RenewOption.toLowerCase();
      expect(
        renewOption === "manual renewal" ||
          renewOption.includes("no") ||
          renewOption === "donot",
      ).toBe(true);
    } finally {
      await destroy(scope);
    }
  }, 120000);
});
