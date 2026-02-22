import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Domain } from "../../src/porkbun/domain.ts";
import { createPorkbunApi } from "../../src/porkbun/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Porkbun Domain", () => {
  test("adopt existing domain run.actor", async (scope) => {
    if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_API_KEY) {
      console.warn("Skipping Porkbun tests: API keys not set");
      return;
    }

    const domainName = process.env.PORKBUN_TEST_DOMAIN;
    if (!domainName) {
      console.log("Skipping Porkbun domain test: missing PORKBUN_TEST_DOMAIN");
      return;
    }

    const api = createPorkbunApi();
    let domain: Domain;

    try {
      // 1. Adopt
      domain = await Domain("main", {
        domain: domainName,
        adopt: true,
      });

      expect(domain.id).toBe(domainName);
      expect(domain.domain).toBe(domainName);
      expect(domain.status).toBeDefined();
      expect(domain.expireDate).toBeDefined();

      // 2. Update (mutable setting - autoRenew)
      // Note: We'll toggle it back if it's different to test synchronization
      const initialAutoRenew = domain.autoRenew;
      domain = await Domain("main", {
        domain: domainName,
        adopt: true,
        autoRenew: !initialAutoRenew,
      });

      expect(domain.autoRenew).toBe(!initialAutoRenew);

      // Verify via API
      const { domains } = await api.post<{ domains: any[] }>("/domain/listAll");
      const apiDomain = domains.find((d) => d.domain === domainName);
      expect(apiDomain.autoRenew.toString()).toBe(
        !initialAutoRenew ? "1" : "0",
      );

      // 3. Revert change
      domain = await Domain("main", {
        domain: domainName,
        adopt: true,
        autoRenew: initialAutoRenew,
      });
      expect(domain.autoRenew).toBe(initialAutoRenew);
    } finally {
      // 4. Destroy (should be NOOP for domain registration)
      await destroy(scope);

      // Verify domain still exists in account
      const { domains } = await api.post<{ domains: any[] }>("/domain/listAll");
      const apiDomain = domains.find((d) => d.domain === domainName);
      expect(apiDomain).toBeDefined();
    }
  }, 120000);
});
