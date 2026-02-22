import { google, type youtube_v3 } from "googleapis";
import { Secret } from "../../secret.ts";

export interface YouTubeApiOptions {
  /**
   * YouTube Client ID (overrides YOUTUBE_CLIENT_ID env var)
   */
  clientId?: string;

  /**
   * YouTube Client Secret (overrides YOUTUBE_CLIENT_SECRET env var)
   */
  clientSecret?: string | Secret;

  /**
   * YouTube Refresh Token (overrides YOUTUBE_REFRESH_TOKEN env var)
   */
  refreshToken?: string | Secret;
}

export interface YouTubeClientContext {
  client: youtube_v3.Youtube;
}

export async function createYouTubeClient(
  options: YouTubeApiOptions = {},
): Promise<YouTubeClientContext> {
  const clientId = options.clientId ?? process.env.YOUTUBE_CLIENT_ID ?? "";
  const clientSecret = Secret.unwrap(
    options.clientSecret ?? process.env.YOUTUBE_CLIENT_SECRET ?? "",
  );
  const refreshToken = Secret.unwrap(
    options.refreshToken ?? process.env.YOUTUBE_REFRESH_TOKEN ?? "",
  );

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN are required",
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  const client = google.youtube({ version: "v3", auth });
  return { client };
}
