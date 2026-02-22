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
  private _applicationId?: string;

  constructor(options: DiscordApiOptions = {}) {
    this.botToken =
      (typeof options.botToken === "string"
        ? options.botToken
        : options.botToken?.unencrypted) ??
      process.env.DISCORD_BOT_TOKEN ??
      "";

    if (!this.botToken) {
      throw new Error("DISCORD_BOT_TOKEN environment variable is required");
    }
  }

  /**
   * Get the application ID for the bot
   */
  async getApplicationId(): Promise<string> {
    if (this._applicationId) return this._applicationId;
    const response = await this.get<{ id: string }>("/users/@me");
    this._applicationId = response.id;
    return this._applicationId;
  }

  /**
   * Make a request to the Discord API
   */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.botToken}`,
      "User-Agent": "Alchemy (https://github.com/alchemy-run/alchemy)",
    };

    if (body) {
      headers["Content-Type"] = "application/json";
    }

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

      let errorData: { message?: string } | string;
      try {
        errorData = (await response.json()) as { message?: string };
        console.error(
          "Discord API Error Body:",
          JSON.stringify(errorData, null, 2),
        );
      } catch {
        errorData = await response.text();
        console.error("Discord API Error Body (Text):", errorData);
      }
      const message =
        typeof errorData === "string"
          ? errorData
          : errorData.message || JSON.stringify(errorData);
      throw new Error(`Discord API Error (${response.status}): ${message}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async postForm<T>(path: string, form: FormData): Promise<T> {
    return this.requestForm<T>("POST", path, form);
  }

  async patch<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  async put<T>(path: string, body: unknown = {}): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Make a multipart/form-data request to the Discord API
   */
  async requestForm<T>(
    method: string,
    path: string,
    form: FormData,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.botToken}`,
      "User-Agent": "Alchemy (https://github.com/alchemy-run/alchemy)",
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: form,
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new Error(`Discord API Rate Limited. Retry after ${retryAfter}s`);
      }

      let errorData: { message?: string } | string;
      try {
        errorData = (await response.json()) as { message?: string };
        console.error(
          "Discord API Error Body:",
          JSON.stringify(errorData, null, 2),
        );
      } catch {
        errorData = await response.text();
        console.error("Discord API Error Body (Text):", errorData);
      }
      const message =
        typeof errorData === "string"
          ? errorData
          : errorData.message || JSON.stringify(errorData);
      throw new Error(`Discord API Error (${response.status}): ${message}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }
}

/**
 * Create a DiscordApi instance
 */
export function createDiscordApi(options: DiscordApiOptions = {}): DiscordApi {
  return new DiscordApi(options);
}
