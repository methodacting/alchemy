# Sticker

Create and manage guild stickers.

## Example

```ts
import { Sticker } from "alchemy/discord";

await Sticker("wave", {
  guild: "GUILD_ID",
  name: "Wave",
  description: "Waving hello",
  tags: "wave, hello",
  file: "data:image/png;base64,..."
});
```

You can also upload from a file path:

```ts
await Sticker("wave", {
  guild: "GUILD_ID",
  name: "Wave",
  description: "Waving hello",
  tags: "wave, hello",
  filePath: "./stickers/wave.png"
});
```

## Notes

- Requires `CREATE_GUILD_EXPRESSIONS` (or `MANAGE_GUILD_EXPRESSIONS`) permission.
- Sticker file must be PNG/APNG/GIF/Lottie, max 512 KiB.
