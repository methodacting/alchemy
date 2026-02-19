import type { Secret } from "../secret.ts";

/**
 * Options for Hetzner Cloud API requests
 */
export interface HetznerApiOptions {
  /**
   * API Token to use (overrides HCLOUD_TOKEN env var)
   */
  token?: Secret;
}

/**
 * Minimal API client for Hetzner Cloud using raw fetch
 */
export class HetznerApi {
  /** Base URL for API */
  readonly baseUrl: string;

  /** API token */
  readonly token: string;

  /**
   * Create a new API client
   *
   * @param options API options
   * @param type The API type to use ("cloud" or "robot")
   */
  constructor(options: HetznerApiOptions = {}, type: "cloud" | "robot" = "cloud") {
    this.baseUrl = type === "cloud" ? "https://api.hetzner.cloud/v1" : "https://api.hetzner.com/v1";
    this.token = options.token?.unencrypted ?? process.env.HCLOUD_TOKEN ?? "";

    if (!this.token) {
      throw new Error("HCLOUD_TOKEN environment variable is required");
    }
  }

  /**
   * Make a request to the API
   *
   * @param path API path (without base URL)
   * @param init Fetch init options
   * @returns JSON response or throws error
   */
  async fetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };

    if (init.headers) {
      const initHeaders = init.headers as Record<string, string>;
      Object.keys(initHeaders).forEach((key) => {
        headers[key] = initHeaders[key];
      });
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      // Hetzner error object structure: { error: { code: string, message: string, ... } }
      const errorMessage = errorData.error?.message || JSON.stringify(errorData);
      throw new Error(
        `Hetzner API Error (${response.status}): ${errorMessage}`
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Helper for GET requests
   */
  async get<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    return this.fetch<T>(path, { ...init, method: "GET" });
  }

  /**
   * Helper for POST requests
   */
  async post<T = any>(
    path: string,
    body: any,
    init: RequestInit = {}
  ): Promise<T> {
    return this.fetch<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Helper for PUT requests
   */
  async put<T = any>(
    path: string,
    body: any,
    init: RequestInit = {}
  ): Promise<T> {
    return this.fetch<T>(path, {
      ...init,
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  /**
   * Helper for DELETE requests
   */
  async delete<T = any>(path: string, init: RequestInit = {}): Promise<T> {
    return this.fetch<T>(path, { ...init, method: "DELETE" });
  }
}

/**
 * Create a HetznerApi instance
 * @param options API options
 * @param type The API type to use ("cloud" or "robot")
 * @returns HetznerApi instance
 */
export function createHetznerApi(
  options: Partial<HetznerApiOptions> = {},
  type: "cloud" | "robot" = "cloud"
): HetznerApi {
  return new HetznerApi(options, type);
}
