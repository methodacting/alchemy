import { Client } from "@notionhq/client";
import type { Secret } from "../secret.ts";

export interface NotionApiOptions {
  /**
   * Notion Integration Token (overrides NOTION_TOKEN env var)
   */
  token?: string | Secret;
}

/**
 * Creates a Notion client using the official SDK.
 */
export function createNotionClient(options: NotionApiOptions = {}): Client {
  // We unwrap secrets immediately or use env vars
  const token = (typeof options.token === "string" ? options.token : options.token?.unencrypted)
    ?? process.env.NOTION_TOKEN
    ?? "";

  if (!token) {
    throw new Error("NOTION_TOKEN environment variable or token prop is required");
  }

  return new Client({
    auth: token,
  });
}
