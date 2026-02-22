import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { Sticker } from "../../src/discord/sticker.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Discord Sticker", () => {
  test("create and update sticker", async (scope) => {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
      console.warn(
        "Skipping Discord sticker tests: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set",
      );
      return;
    }

    const stickerData = process.env.DISCORD_TEST_STICKER_DATA_URI;
    const stickerFilePath = process.env.DISCORD_TEST_STICKER_FILE;
    if (!stickerData && !stickerFilePath) {
      console.warn(
        "Skipping Discord sticker tests: DISCORD_TEST_STICKER_DATA_URI or DISCORD_TEST_STICKER_FILE not set",
      );
      return;
    }

    const baseName = `${BRANCH_PREFIX}-sticker`;
    let sticker: Sticker;

    try {
      sticker = await Sticker("main", {
        guild: process.env.DISCORD_GUILD_ID,
        name: `${baseName}-one`,
        description: "Alchemy test sticker",
        tags: "alchemy, test",
        file: stickerData,
        filePath: stickerFilePath,
      });

      expect(sticker.id).toBeDefined();
      expect(sticker.name).toBe(`${baseName}-one`);

      sticker = await Sticker("main", {
        guild: process.env.DISCORD_GUILD_ID,
        name: `${baseName}-one`,
        description: "Updated description",
        tags: "alchemy, test, updated",
      });

      expect(sticker.description).toBe("Updated description");
    } finally {
      await destroy(scope);
    }
  }, 180000);
});
