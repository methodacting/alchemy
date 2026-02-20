import { createHmac } from "node:crypto";
import { Secret } from "../secret.ts";

/**
 * Options for Dynadot API requests
 */
export interface DynadotApiOptions {
  /**
   * API Key (overrides DYNADOT_API_KEY env var)
   */
  apiKey?: string | Secret;
  /**
   * API Secret (overrides DYNADOT_API_SECRET env var)
   */
  apiSecret?: string | Secret;
  /**
   * Whether to use the sandbox environment
   * @default DYNADOT_SANDBOX env var or false
   */
  sandbox?: boolean;
}

/**
 * API client for Dynadot RESTful API V2
 */
export class DynadotApi {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly apiSecret: string;

  constructor(options: DynadotApiOptions = {}) {
    this.apiKey = (typeof options.apiKey === "string" ? options.apiKey : options.apiKey?.unencrypted)
      ?? process.env.DYNADOT_API_KEY
      ?? "";
    
    this.apiSecret = (typeof options.apiSecret === "string" ? options.apiSecret : options.apiSecret?.unencrypted)
      ?? process.env.DYNADOT_API_SECRET
      ?? "";

    const useSandbox = options.sandbox ?? process.env.DYNADOT_SANDBOX === "true";
    this.baseUrl = useSandbox ? "https://api-sandbox.dynadot.com" : "https://api.dynadot.com";

    if (!this.apiKey || !this.apiSecret) {
      throw new Error("DYNADOT_API_KEY and DYNADOT_API_SECRET environment variables are required");
    }
  }

  /**
   * Generate X-Signature header using HMAC-SHA256
   * The signature string format is: apiKey\nfullPath\n\nrequestBody
   */
  private generateSignature(path: string, body: string = ""): string {
    const signatureString = `${this.apiKey}\n${path}\n\n${body}`;
    return createHmac("sha256", this.apiSecret)
      .update(signatureString)
      .digest("base64");
  }

  /**
   * Make a request to the Dynadot API
   */
  async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    const fullPath = `/restful/v2${path}`;
    const stringBody = body ? JSON.stringify(body) : "";
    const signature = this.generateSignature(fullPath, stringBody);

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.apiKey}`,
      "X-Signature": signature,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const response = await fetch(`${this.baseUrl}${fullPath}`, {
      method,
      headers,
      body: body ? stringBody : undefined,
    });

    if (!response.ok) {
      let errorData: any;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: await response.text() };
      }
      throw new Error(`Dynadot API Error (${response.status}): ${errorData.error?.message || errorData.message || JSON.stringify(errorData)}`);
    }

    const data = await response.json() as any;
    // Dynadot response structure usually has a top-level property matching the resource
    // or an 'error' property.
    if (data.error) {
      throw new Error(`Dynadot API Logic Error: ${data.error.message || "Unknown error"}`);
    }

    return data as T;
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T = any>(path: string, body: any = {}): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}

/**
 * Create a DynadotApi instance
 */
export function createDynadotApi(options: DynadotApiOptions = {}): DynadotApi {
  return new DynadotApi(options);
}
