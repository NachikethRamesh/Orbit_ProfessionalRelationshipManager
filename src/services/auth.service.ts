import { google } from "googleapis";
import { getDb } from "@/lib/db";
import { connectedAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import crypto from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

function createOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getGoogleAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: userId,
  });
}

export async function handleGoogleCallback(code: string, userId: string): Promise<void> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();
  const accountEmail = userInfo.email ?? "";

  const encryptedAccessToken = encrypt(tokens.access_token!);
  const encryptedRefreshToken = encrypt(tokens.refresh_token!);

  const db = getDb();

  // Upsert: try update first, insert if not found
  const existing = db.select({ id: connectedAccounts.id }).from(connectedAccounts)
    .where(and(
      eq(connectedAccounts.user_id, userId),
      eq(connectedAccounts.provider, "google"),
      eq(connectedAccounts.account_email, accountEmail),
    ))
    .get();

  if (existing) {
    db.update(connectedAccounts).set({
      google_access_token: encryptedAccessToken,
      google_refresh_token: encryptedRefreshToken,
      updated_at: new Date().toISOString(),
    }).where(eq(connectedAccounts.id, existing.id)).run();
  } else {
    db.insert(connectedAccounts).values({
      id: crypto.randomUUID(),
      user_id: userId,
      provider: "google",
      account_email: accountEmail,
      google_access_token: encryptedAccessToken,
      google_refresh_token: encryptedRefreshToken,
    }).run();
  }
}

export async function refreshGoogleToken(accountId: string): Promise<string> {
  const db = getDb();

  const account = db.select({ google_refresh_token: connectedAccounts.google_refresh_token })
    .from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).get();

  if (!account?.google_refresh_token) {
    throw new Error("No Google refresh token found. User must re-authenticate.");
  }

  const refreshToken = decrypt(account.google_refresh_token);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error("Google token refresh did not return an access token.");
  }

  const encryptedAccessToken = encrypt(credentials.access_token);
  db.update(connectedAccounts)
    .set({ google_access_token: encryptedAccessToken })
    .where(eq(connectedAccounts.id, accountId)).run();

  return credentials.access_token;
}

export async function getValidAccessToken(accountId: string): Promise<string> {
  const db = getDb();

  const account = db.select({ google_access_token: connectedAccounts.google_access_token })
    .from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).get();

  if (account?.google_access_token) {
    try {
      const accessToken = decrypt(account.google_access_token);
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });
      await oauth2Client.getTokenInfo(accessToken);
      return accessToken;
    } catch {
      // Token expired, fall through to refresh
    }
  }

  return refreshGoogleToken(accountId);
}

export async function listConnectedAccounts(
  userId: string,
  provider?: string
): Promise<{ id: string; provider: string; account_email: string; connected_at: string }[]> {
  const db = getDb();

  const conditions = provider
    ? and(eq(connectedAccounts.user_id, userId), eq(connectedAccounts.provider, provider))
    : eq(connectedAccounts.user_id, userId);

  const results = db.select({
    id: connectedAccounts.id,
    provider: connectedAccounts.provider,
    account_email: connectedAccounts.account_email,
    connected_at: connectedAccounts.connected_at,
  }).from(connectedAccounts)
    .where(conditions)
    .orderBy(connectedAccounts.connected_at)
    .all();

  return results as any[];
}

export async function disconnectAccount(accountId: string, userId: string): Promise<void> {
  const db = getDb();
  db.delete(connectedAccounts)
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.user_id, userId)))
    .run();
}
