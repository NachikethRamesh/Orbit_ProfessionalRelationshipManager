/**
 * Chat Sessions Route — GET & POST /api/chat/sessions
 *
 * GET: Lists all chat sessions for the user (newest first).
 * POST: Creates a new chat session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { listChatSessions, createChatSession } from "@/services/chat.service";

export async function GET(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const sessions = await listChatSessions(user!.id);
    return NextResponse.json(sessions);
  } catch (err) {
    console.error("[GET /api/chat/sessions] Error:", err);
    return NextResponse.json(
      { error: "Failed to list chat sessions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const session = await createChatSession(user!.id);
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error("[POST /api/chat/sessions] Error:", err);
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    );
  }
}
