/**
 * Google OAuth Callback Route — GET /api/auth/google/callback
 *
 * This is the redirect URI registered in the Google Cloud Console.
 * After the user grants consent on Google's OAuth screen, Google
 * redirects them here with an authorization code, the state parameter,
 * and the granted scopes.
 *
 * This route:
 *  1. Checks if the user denied consent or if an error occurred.
 *  2. Verifies all required scopes were granted.
 *  3. Exchanges the code for access + refresh tokens via the auth service.
 *  4. Redirects the user to /connect with a success or error indicator.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleGoogleCallback } from '@/services/auth.service';

export const dynamic = 'force-dynamic';

/* The scopes we require for the CRM to function */
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
];

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const { searchParams } = new URL(req.url);

    /* If Google returns an error (e.g., user clicked "Cancel") */
    const oauthError = searchParams.get('error');
    if (oauthError) {
      return NextResponse.redirect(
        `${baseUrl}/connect?error=permissions_denied`
      );
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/connect?error=missing_params`
      );
    }

    /* Check that all required scopes were granted */
    const grantedScopes = searchParams.get('scope') ?? '';
    const grantedList = grantedScopes.split(' ').filter(Boolean);
    const missingScopes = REQUIRED_SCOPES.filter(
      (s) => !grantedList.includes(s)
    );

    if (missingScopes.length > 0) {
      return NextResponse.redirect(
        `${baseUrl}/connect?error=insufficient_permissions`
      );
    }

    /* Exchange the code for tokens and store them encrypted */
    await handleGoogleCallback(code, state);

    return NextResponse.redirect(`${baseUrl}/connect?connected=true`);
  } catch (err) {
    console.error('[GET /api/auth/google/callback] Error:', err);
    return NextResponse.redirect(
      `${baseUrl}/connect?error=google_connect_failed`
    );
  }
}
