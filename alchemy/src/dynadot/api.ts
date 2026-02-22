import { Secret } from "../secret.ts";
import { withExponentialBackoff } from "../util/retry.ts";
import type { DynadotV3Header } from "./types.ts";

/**
 * Options for Dynadot API requests
 */
export interface DynadotApiOptions {
  /**
   * API Key (overrides DYNADOT_API_KEY env var)
   */
  apiKey?: string | Secret;
  /**
   * Whether to use the sandbox environment
   * @default DYNADOT_SANDBOX env var or false
   */
  sandbox?: boolean;
}

/**
 * API client for Dynadot API V3 (api3.json)
 */
export class DynadotApi {
  readonly baseUrl: string;
  readonly apiKey: string;

  constructor(options: DynadotApiOptions = {}) {
    this.apiKey =
      (typeof options.apiKey === "string"
        ? options.apiKey
        : options.apiKey?.unencrypted) ??
      process.env.DYNADOT_API_KEY ??
      "";

    const useSandbox =
      options.sandbox ?? process.env.DYNADOT_SANDBOX === "true";
    this.baseUrl = useSandbox
      ? "https://api-sandbox.dynadot.com/api3.json"
      : "https://api.dynadot.com/api3.json";

    if (!this.apiKey) {
      throw new Error("DYNADOT_API_KEY environment variable is required");
    }
  }

  /**
   * Make a request to the Dynadot API
   *
   * Note: Dynadot only processes one request at a time per account. When the
   * API returns error code -1 ("currently processing another request from this account"),
   * we retry with exponential backoff.
   */
  async request<T>(
    command: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    return await withExponentialBackoff(
      async () => {
        const url = new URL(this.baseUrl);
        url.searchParams.append("key", this.apiKey);
        url.searchParams.append("command", command);

        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined) {
            url.searchParams.append(key, value.toString());
          }
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(
            `Dynadot API HTTP Error (${response.status}): ${await response.text()}`,
          );
        }

        const data = (await response.json()) as Record<
          string,
          DynadotV3Header & T
        >;

        // Dynadot V3 responses are wrapped in a {Command}Response object
        const responseKey = Object.keys(data).find((k) =>
          k.endsWith("Response"),
        );
        if (!responseKey) {
          throw new Error(
            `Dynadot API Unexpected Response Format: ${JSON.stringify(data)}`,
          );
        }

        const commandResponse = data[responseKey];
        const responseCode =
          commandResponse.ResponseCode?.toString() ??
          (commandResponse as any).SuccessCode?.toString();

        // ResponseCode 0 is success
        if (responseCode !== "0" && responseCode !== undefined) {
          const error = new Error(
            `Dynadot API Error (${responseCode}): ${commandResponse.Error || "Unknown error"}`,
          ) as Error & { code?: string };
          error.code = responseCode;
          throw error;
        }

        return commandResponse as T;
      },
      (error) => (error as { code?: string })?.code === "-1",
      10,
      500,
      8000,
    );
  }

  async get<T>(
    command: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>(command, params);
  }

  async post<T>(
    command: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    return this.request<T>(command, params);
  }
}

/**
 * Create a DynadotApi instance
 */
export function createDynadotApi(options: DynadotApiOptions = {}): DynadotApi {
  return new DynadotApi(options);
}
