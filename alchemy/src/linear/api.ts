import { Secret } from "../secret.ts";

/**
 * Options for Linear API requests
 */
export interface LinearApiOptions {
  /**
   * Linear Personal API Key (overrides LINEAR_API_KEY env var)
   */
  apiKey?: string | Secret;
}

export interface LinearGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export interface LinearClientContext {
  apiKey: string;
  endpoint: string;
}

const LINEAR_API_ENDPOINT = "https://api.linear.app/graphql";

/**
 * Creates Linear API context using raw fetch
 */
export function createLinearClient(
  options: LinearApiOptions = {},
): LinearClientContext {
  const apiKey = Secret.unwrap(
    options.apiKey ?? process.env.LINEAR_API_KEY ?? "",
  );

  if (!apiKey) {
    throw new Error(
      "LINEAR_API_KEY environment variable or apiKey prop is required",
    );
  }

  return {
    apiKey,
    endpoint: LINEAR_API_ENDPOINT,
  };
}

export async function linearGraphql<T>(
  client: LinearClientContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(client.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: client.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear API Error (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as LinearGraphQLResponse<T>;
  if (payload.errors?.length) {
    throw new Error(`Linear GraphQL Error: ${payload.errors[0].message}`);
  }

  if (!payload.data) {
    throw new Error("Linear GraphQL Error: empty response data");
  }

  return payload.data;
}
