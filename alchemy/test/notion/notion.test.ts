import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Database } from "../../src/notion/database.ts";
import { Page } from "../../src/notion/page.ts";
import { createNotionClient } from "../../src/notion/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Notion", () => {
  test("create page and database", async (scope) => {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PARENT_PAGE_ID) {
      console.warn("Skipping Notion tests: NOTION_TOKEN or NOTION_PARENT_PAGE_ID not set");
      return;
    }

    const notion = createNotionClient();
    const baseName = `${BRANCH_PREFIX}-test-${Date.now()}`;

    try {
      // 1. Create Parent Page
      const parentPage = await Page("root", {
        parent: process.env.NOTION_PARENT_PAGE_ID,
        properties: {
          title: [{ text: { content: `${baseName} Documentation` } }]
        }
      });

      expect(parentPage.id).toBeDefined();
      expect(parentPage.url).toBeDefined();

      // 2. Create Database in Page
      const db = await Database("logs", {
        parent: parentPage,
        title: [{ text: { content: "Deploy Logs" } }],
        properties: {
          "Name": { title: {} },
          "Status": { select: { options: [{ name: "Success", color: "green" }, { name: "Failure", color: "red" }] } },
          "Date": { date: {} }
        }
      });

      expect(db.id).toBeDefined();
      expect(db.parentId).toBe(parentPage.id);

      // 3. Create Entry in Database
      const entry = await Page("log-entry", {
        parent: db,
        properties: {
          "Name": { title: [{ text: { content: "Initial Deploy" } }] },
          "Status": { select: { name: "Success" } },
          "Date": { date: { start: new Date().toISOString() } }
        }
      });

      expect(entry.id).toBeDefined();
      expect(entry.parentId).toBe(db.id);
      expect(entry.parentType).toBe("database_id");

      // Verify via SDK
      const apiDb = await notion.databases.retrieve({ database_id: db.id });
      expect(apiDb.properties["Status"]).toBeDefined();

    } finally {
      await destroy(scope);
    }
  }, 300000);
});
