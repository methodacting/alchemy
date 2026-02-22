import { ApiClient } from "@twurple/api";
import { StaticAuthProvider } from "@twurple/auth";
import { Secret } from "../../secret.ts";

export interface TwitchApiOptions {
  /**
   * Twitch Client ID (overrides TWITCH_CLIENT_ID env var)
   */
  clientId?: string;

  /**
   * Twitch Client Secret (overrides TWITCH_CLIENT_SECRET env var)
   */
  clientSecret?: string | Secret;

  /**
   * Twitch Refresh Token (overrides TWITCH_REFRESH_TOKEN env var)
   */
  refreshToken?: string | Secret;
}

export interface TwitchClientContext {
  client: ApiClient;
  userId: string;
  clientId: string;
  accessToken: string;
}

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

async function fetchAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TWITCH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twitch token refresh failed (${response.status}): ${text}`,
    );
  }

  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Twitch token refresh did not return access_token");
  }

  return { accessToken: json.access_token };
}

export async function createTwitchClient(
  options: TwitchApiOptions = {},
): Promise<TwitchClientContext> {
  const clientId = options.clientId ?? process.env.TWITCH_CLIENT_ID ?? "";
  const clientSecret = Secret.unwrap(
    options.clientSecret ?? process.env.TWITCH_CLIENT_SECRET ?? "",
  );
  const refreshToken = Secret.unwrap(
    options.refreshToken ?? process.env.TWITCH_REFRESH_TOKEN ?? "",
  );

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, and TWITCH_REFRESH_TOKEN are required",
    );
  }

  const { accessToken } = await fetchAccessToken(
    clientId,
    clientSecret,
    refreshToken,
  );
  const authProvider = new StaticAuthProvider(clientId, accessToken);
  const client = new ApiClient({ authProvider });

  const user = await client.users.getAuthenticatedUser();
  if (!user) {
    throw new Error("Unable to resolve authenticated Twitch user");
  }

  return {
    client,
    userId: user.id,
    clientId,
    accessToken,
  };
}
