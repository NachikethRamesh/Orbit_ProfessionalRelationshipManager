/**
 * Single Chat Session Route — DELETE /api/chat/sessions/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import { deleteChatSession } from "@/services/chat.service";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const { id } = await params;
    await deleteChatSession(user!.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/chat/sessions/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
}
