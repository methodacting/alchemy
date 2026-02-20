import type { Secret } from "../secret.ts";

/**
 * Options for Discord API requests
 */
export interface DiscordApiOptions {
  /**
   * Discord Bot Token (overrides DISCORD_BOT_TOKEN env var)
   */
  botToken?: string | Secret;
}

/**
 * API client for Discord REST API V10
 */
export class DiscordApi {
  readonly baseUrl: string = "https://discord.com/api/v10";
  readonly botToken: string;

  constructor(options: DiscordApiOptions = {}) {
    this.botToken = (typeof options.botToken === "string" ? options.botToken : options.botToken?.unencrypted)
      ?? process.env.DISCORD_BOT_TOKEN
      ?? "";

    if (!this.botToken) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is required");
    }
  }

  /**
   * Make a request to the Discord API
   */
  async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    const headers: Record<string, string> = {
      "Authorization": `Bot ${this.botToken}`,
      "Content-Type": "application/json",
      "User-Agent": "Alchemy (https://github.com/alchemy-run/alchemy)",
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Discord API Rate Limited. Retry after ${retryAfter}s`);
      }

      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(`Discord API Error (${response.status}): ${errorData.message || JSON.stringify(errorData)}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return await response.json() as T;
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async put<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

/**
 * Create a DiscordApi instance
 */
export function createDiscordApi(options: DiscordApiOptions = {}): DiscordApi {
  return new DiscordApi(options);
}
