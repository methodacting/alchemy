import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/dynadot/domain.ts";
import { createDynadotApi } from "../../src/dynadot/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const api = createDynadotApi({ sandbox: true });

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Dynadot Domain", () => {
  test("adopt or register domain in sandbox", async (scope) => {
    if (!process.env.DYNADOT_API_KEY || !process.env.DYNADOT_API_SECRET) {
      console.warn("Skipping Dynadot tests: API keys not set");
      return;
    }

    const domainName = `alchemy-test-${Date.now()}.com`;
    let domain: any;

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
      const response = await api.get<{ domainList: any[] }>(`/domains/${domainName}`);
      expect(response.domainList[0].autoRenew).toBe("off");

    } finally {
      await destroy(scope);
    }
  }, 120000);
});
