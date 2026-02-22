import { describe, expect } from "vitest";
process.env.ALCHEMY_PASSWORD = "test-password";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { SoundboardSound } from "../../src/discord/soundboard-sound.ts";
import { BRANCH_PREFIX } from "../util.ts";
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("Discord SoundboardSound", () => {
  test("create and update soundboard sound", async (scope) => {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
      console.warn(
        "Skipping Discord soundboard tests: DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set",
      );
      return;
    }

    const soundData = process.env.DISCORD_TEST_SOUNDBOARD_DATA_URI;
    const soundFilePath = process.env.DISCORD_TEST_SOUNDBOARD_FILE;
    if (!soundData && !soundFilePath) {
      console.warn(
        "Skipping Discord soundboard tests: DISCORD_TEST_SOUNDBOARD_DATA_URI or DISCORD_TEST_SOUNDBOARD_FILE not set",
      );
      return;
    }

    const baseName = `${BRANCH_PREFIX}-sound`;
    let sound: SoundboardSound;

    try {
      sound = await SoundboardSound("main", {
        guild: process.env.DISCORD_GUILD_ID,
        name: `${baseName}-one`,
        sound: soundData,
        soundFilePath: soundFilePath,
        volume: 1,
      });

      expect(sound.id).toBeDefined();
      expect(sound.name).toBe(`${baseName}-one`);

      sound = await SoundboardSound("main", {
        guild: process.env.DISCORD_GUILD_ID,
        name: `${baseName}-one`,
        volume: 0.5,
      });

      expect(sound.volume).toBe(0.5);
    } finally {
      await destroy(scope);
    }
  }, 180000);
});
