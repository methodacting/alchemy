# SoundboardSound

Create and manage guild soundboard sounds.

## Example

```ts
import { SoundboardSound } from "alchemy/discord";

await SoundboardSound("yay", {
  guild: "GUILD_ID",
  name: "Yay",
  sound: "data:audio/ogg;base64,...",
  volume: 1,
  emojiName: "🎉"
});
```

You can also upload from a file path:

```ts
await SoundboardSound("yay", {
  guild: "GUILD_ID",
  name: "Yay",
  soundFilePath: "./sounds/yay.ogg",
});
```

## Notes

- Requires `CREATE_GUILD_EXPRESSIONS` (or `MANAGE_GUILD_EXPRESSIONS`) permission.
- Max file size is 512 KB and max duration is 5.2 seconds.
