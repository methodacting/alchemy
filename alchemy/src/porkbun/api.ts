import { Secret } from "../secret.ts";

/**
 * Options for Porkbun API requests
 */
export interface PorkbunApiOptions {
  /**
   * API Key (overrides PORKBUN_API_KEY env var)
   */
  apiKey?: string | Secret;
  /**
   * Secret API Key (overrides PORKBUN_SECRET_API_KEY env var)
   */
  secretApiKey?: string | Secret;
}

/**
 * Minimal API client for Porkbun using raw fetch.
 * Note: Porkbun requires apiKey and secretApiKey in the JSON body for ALL requests.
 */
export class PorkbunApi {
  readonly baseUrl: string = "https://api.porkbun.com/api/json/v3";
  readonly apiKey: string;
  readonly secretApiKey: string;

  constructor(options: PorkbunApiOptions = {}) {
    // We unwrap secrets immediately or use env vars
    this.apiKey = Secret.unwrap(
      options.apiKey ?? process.env.PORKBUN_API_KEY ?? "",
    );
    this.secretApiKey = Secret.unwrap(
      options.secretApiKey ?? process.env.PORKBUN_SECRET_API_KEY ?? "",
    );

    if (!this.apiKey || !this.secretApiKey) {
      throw new Error(
        "PORKBUN_API_KEY and PORKBUN_SECRET_API_KEY environment variables are required",
      );
    }
  }

  /**
   * Make a request to the Porkbun API.
   * All requests are POST because auth info must be in the body.
   */
  async request<T = any>(path: string, body: any = {}): Promise<T> {
    const fullBody = {
      ...body,
      apikey: this.apiKey,
      secretapikey: this.secretApiKey,
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fullBody),
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(
        `Porkbun API Error (${response.status}): ${errorData.message || JSON.stringify(errorData)}`,
      );
    }

    const data = (await response.json()) as any;
    if (data.status === "ERROR") {
      throw new Error(
        `Porkbun API Logic Error: ${data.message || "Unknown error"}`,
      );
    }

    return data as T;
  }

  /**
   * Helper for standard GET-like operations (which are POSTs in Porkbun)
   */
  async post<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>(path, body);
  }
}

/**
 * Create a PorkbunApi instance
 */
export function createPorkbunApi(options: PorkbunApiOptions = {}): PorkbunApi {
  return new PorkbunApi(options);
}
