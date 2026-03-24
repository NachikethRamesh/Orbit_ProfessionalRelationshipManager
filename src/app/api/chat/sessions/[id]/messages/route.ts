/**
 * Chat Messages Route — GET /api/chat/sessions/[id]/messages
 *
 * Loads all messages for a chat session.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { loadChatMessages } from "@/services/chat.service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const { id } = await params;
    const messages = await loadChatMessages(user!.id, id);
    return NextResponse.json(messages);
  } catch (err) {
    console.error("[GET /api/chat/sessions/[id]/messages] Error:", err);
    return NextResponse.json(
      { error: "Failed to load chat messages" },
      { status: 500 }
    );
  }
}
