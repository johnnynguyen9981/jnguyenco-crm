// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth2 — Token management
// All token handling is SERVER-SIDE ONLY. Tokens never touch the browser.
// ─────────────────────────────────────────────────────────────────────────────
import { google } from "googleapis";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Scopes we request from the user during OAuth consent.
 * Both are "sensitive" scopes (free, ~10-day Google verification).
 * Deliberately NOT requesting a Drive scope here: the full
 * "https://www.googleapis.com/auth/drive" scope is "restricted" and
 * requires an annual paid CASA security assessment to verify for
 * production use. All Drive access in this app goes through the
 * service account (lib/google/drive.ts) instead, which isn't subject
 * to this end-user OAuth verification flow at all.
 */
export const GOOGLE_SCOPES = [
      "https://www.googleapis.com/auth/gmail.send",       // Send email as johnny.nguyen@jnguyen.co
      "https://www.googleapis.com/auth/calendar.events",  // Create/update calendar events
    ];

/** Build an OAuth2 client from environment credentials */
export function getOAuth2Client() {
      return new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID!,
              process.env.GOOGLE_CLIENT_SECRET!,
              process.env.GOOGLE_REDIRECT_URI!
            );
}

/**
 * Generate the Google consent-screen URL.
 * Redirect the user here when they click "Connect Google" in Settings.
 */
export function getGoogleAuthUrl(): string {
      const client = getOAuth2Client();
      return client.generateAuthUrl({
              access_type: "offline",        // Required to get a refresh_token
              prompt:      "consent",        // Force consent screen so refresh_token is always returned
              scope:       GOOGLE_SCOPES,
              state:       "google_connect", // Tells /api/auth/callback this is a token exchange, not a Supabase login
      });
}

/**
 * Exchange the one-time auth_code (from Google callback) for tokens,
 * then persist them to the google_tokens table.
 * Called only from /api/auth/callback — never from the browser.
 */
export async function exchangeCodeAndSaveTokens(
      code: string,
      userId: string
    ): Promise<void> {
      const client = getOAuth2Client();
      const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
          throw new Error(
                    "Google did not return all required tokens. Make sure prompt=consent is set."
                  );
  }

  const supabase = await createClient();
      const { error } = await supabase.from("google_tokens").upsert(
          {
                    owner_id:      userId,
                    access_token:  tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_expiry:  new Date(tokens.expiry_date).toISOString(),
                    scopes:        GOOGLE_SCOPES.join(" "),
                    updated_at:    new Date().toISOString(),
          },
          { onConflict: "owner_id" }
            );

  if (error) {
          throw new Error(`Failed to save Google tokens: ${error.message}`);
  }
}

/**
 * Returns an authenticated OAuth2 client for the given user.
 * Automatically refreshes the access_token if it is expired or within
 * 5 minutes of expiry, and persists the new token back to Supabase.
 *
 * Usage:
 *   const authClient = await getAuthenticatedClient(session.user.id);
 *   const gmail = google.gmail({ version: "v1", auth: authClient });
 */
export async function getAuthenticatedClient(userId: string) {
      const supabase = await createClient();

  const { data: row, error } = await supabase
        .from("google_tokens")
        .select("access_token, refresh_token, token_expiry")
        .eq("owner_id", userId)
        .single();

  if (error || !row) {
          throw new Error(
                    "Google account not connected. Please connect it in Settings → Integrations."
                  );
  }

  const oauthClient = getOAuth2Client();
      oauthClient.setCredentials({
              access_token:  row.access_token,
              refresh_token: row.refresh_token,
      });

  // Refresh if expired or within 5 minutes of expiry
  const expiryMs   = new Date(row.token_expiry).getTime();
      const bufferMs   = 5 * 60 * 1000; // 5 minutes
  if (Date.now() >= expiryMs - bufferMs) {
          try {
                    const { credentials } = await oauthClient.refreshAccessToken();
                    oauthClient.setCredentials(credentials);

            // Persist the refreshed access token (refresh_token stays the same)
            await supabase
                      .from("google_tokens")
                      .update({
                                    access_token: credentials.access_token!,
                                    token_expiry: new Date(credentials.expiry_date!).toISOString(),
                                    updated_at:   new Date().toISOString(),
                      })
                      .eq("owner_id", userId);
          } catch (refreshErr: any) {
                    // "invalid_grant" means Google has revoked/expired the refresh token itself
            // (common causes: OAuth consent screen still in "Testing" mode — Google
            // expires those refresh tokens after 7 days regardless of use — or the
            // user revoked access / changed their Google password). No amount of
            // retrying will fix this; the user must go through the consent screen
            // again to get a brand-new refresh token.
            if (refreshErr.message?.includes("invalid_grant")) {
                        throw new Error(
                                      "Your Google account connection has expired and needs to be reconnected. Go to Settings → Integrations and click \"Re-connect Google\"."
                                    );
            }
                    throw refreshErr;
          }
  }

  return oauthClient;
}

/**
 * Same as getAuthenticatedClient but uses the service-role Supabase client.
 * Use this in public API routes that have no user session (e.g. /api/sign/[token]).
 * Pass the booking's owner_id so we can look up their stored OAuth tokens.
 */
export async function getAuthenticatedClientByOwnerId(ownerId: string) {
      const supabase = createServiceClient();

  const { data: row, error } = await supabase
        .from("google_tokens")
        .select("access_token, refresh_token, token_expiry")
        .eq("owner_id", ownerId)
        .single();

  if (error || !row) {
          throw new Error("Google account not connected for this owner.");
  }

  const oauthClient = getOAuth2Client();
      oauthClient.setCredentials({
              access_token:  row.access_token,
              refresh_token: row.refresh_token,
      });

  const expiryMs = new Date(row.token_expiry).getTime();
      if (Date.now() >= expiryMs - 5 * 60 * 1000) {
              try {
                        const { credentials } = await oauthClient.refreshAccessToken();
                        oauthClient.setCredentials(credentials);
                        await supabase
                          .from("google_tokens")
                          .update({
                                        access_token: credentials.access_token!,
                                        token_expiry: new Date(credentials.expiry_date!).toISOString(),
                                        updated_at:   new Date().toISOString(),
                          })
                          .eq("owner_id", ownerId);
              } catch (refreshErr: any) {
                        if (refreshErr.message?.includes("invalid_grant")) {
                                    throw new Error(
                                                  "Google account connection has expired for this owner and needs to be reconnected in Settings → Integrations."
                                                );
                        }
                        throw refreshErr;
              }
      }

  return oauthClient;
}

/**
 * Check whether the current user has connected their Google account.
 */
export async function isGoogleConnected(userId: string): Promise<boolean> {
      const supabase = await createClient();
      const { data } = await supabase
        .from("google_tokens")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();
      return !!data;
}
