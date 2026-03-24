/**
 * Google Disconnect Route — POST /api/auth/google/disconnect
 *
 * Removes a specific connected Google account from the user's record.
 * Expects { accountId: string } in the request body to identify which
 * account to disconnect.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { disconnectAccount } from "@/services/auth.service";

export async function POST(req: NextRequest) {
  try {
    /* Authenticate the user */
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    /* Parse the accountId from the request body */
    const body = await req.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    /* Delete the specific connected account (ownership verified in service) */
    await disconnectAccount(accountId, user!.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/auth/google/disconnect] Error:", err);
    return NextResponse.json(
      { error: "Failed to disconnect Google account" },
      { status: 500 }
    );
  }
}
