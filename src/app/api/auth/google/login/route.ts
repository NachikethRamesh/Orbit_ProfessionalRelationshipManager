/**
 * Google OAuth Login Route — GET /api/auth/google/login
 *
 * Returns the Google OAuth2 consent URL that the frontend should
 * redirect the user to. The URL includes all required scopes
 * (Gmail, Calendar, profile) and carries the user's ID in the
 * OAuth state parameter so we can link the tokens after callback.
 *
 * Requires authentication: the user must already be logged in
 * (via Supabase Auth) before connecting their Google account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/app/api/_helpers/auth';
import { getGoogleAuthUrl } from '@/services/auth.service';

/**
 * GET /api/auth/google/login
 *
 * Generates and returns the Google OAuth consent URL.
 * The frontend uses this URL to redirect the user to Google's consent screen.
 *
 * @returns { url: string } — The full Google OAuth2 authorization URL.
 */
export async function GET(req: NextRequest) {
  try {
    /* Authenticate the user via Bearer token */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Generate the Google OAuth consent URL with the user's ID as state */
    const url = getGoogleAuthUrl(user!.id);

    return NextResponse.json({ url });
  } catch (err) {
    /* Catch unexpected errors and return a generic 500 response */
    console.error('[GET /api/auth/google/login] Error:', err);
    return NextResponse.json(
      { error: 'Failed to generate Google auth URL' },
      { status: 500 }
    );
  }
}
