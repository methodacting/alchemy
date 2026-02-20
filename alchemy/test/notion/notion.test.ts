import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Database } from "../../src/notion/database.ts";
import { DataSource } from "../../src/notion/data-source.ts";
import { Page } from "../../src/notion/page.ts";
import { Block } from "../../src/notion/block.ts";
import { createNotionClient } from "../../src/notion/api.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Notion", () => {
  test("create nested infrastructure hierarchy", async (scope) => {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_PARENT_PAGE_ID) {
      console.warn("Skipping Notion tests: NOTION_TOKEN or NOTION_PARENT_PAGE_ID not set");
      return;
    }

    const notion = createNotionClient();
    const baseName = `${BRANCH_PREFIX}-test-${Date.now()}`;

    try {
      // 1. Create Parent Page
      const rootPage = await Page("root", {
        parent: process.env.NOTION_PARENT_PAGE_ID,
        properties: {
          title: [{ text: { content: `${baseName} Workspace` } }]
        }
      });

      expect(rootPage.id).toBeDefined();

      // 2. Create Database Container
      const db = await Database("hub", {
        parent: rootPage,
        title: [{ text: { content: "Resource Hub" } }]
      });

      expect(db.id).toBeDefined();

      // 3. Create Data Source (Table)
      const source = await DataSource("logs-table", {
        database: db,
        title: "Deployment Logs",
        properties: {
          "Name": { title: {} },
          "Status": { select: { options: [{ name: "Success", color: "green" }] } }
        }
      });

      expect(source.id).toBeDefined();
      expect(source.databaseId).toBe(db.id);

      // 4. Create Entry in Data Source
      const entry = await Page("log-entry", {
        parent: source,
        properties: {
          "Name": { title: [{ text: { content: "Manual Deploy" } }] },
          "Status": { select: { name: "Success" } }
        }
      });

      expect(entry.id).toBeDefined();
      expect(entry.parentType).toBe("data_source_id");

      // 5. Add Content Block to the Page
      const content = await Block("desc", {
        parent: entry,
        block: {
          type: "paragraph",
          paragraph: {
            rich_text: [{ text: { content: "This deployment was verified by Alchemy." } }]
          }
        }
      });

      expect(content.id).toBeDefined();

      // Verify via SDK
      const apiSource = await (notion as any).dataSources.retrieve({ data_source_id: source.id });
      expect(apiSource.title).toBe("Deployment Logs");

    } finally {
      await destroy(scope);
    }
  }, 300000);
});
