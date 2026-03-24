/**
 * Chat Route — POST /api/chat
 *
 * Streams an AI response using Server-Sent Events.
 * Persists both user and assistant messages to the chat session.
 *
 * Body: {
 *   session_id: string,
 *   messages: { role: "user" | "assistant", content: string }[]
 * }
 */

import { NextRequest } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import {
  chatStream,
  saveChatMessage,
  autoTitleSession,
  loadChatMessages,
} from "@/services/chat.service";

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await getAuthUser(req);
    if (error) return error;

    const body = await req.json();
    const { session_id, messages } = body as {
      session_id: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!session_id || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "session_id and messages are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    /* Save the user's message */
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg.role === "user") {
      await saveChatMessage(session_id, "user", lastUserMsg.content);
    }

    /* Load full conversation history from DB for context awareness */
    const fullHistory = await loadChatMessages(user!.id, session_id);

    /* Auto-title on the first user message */
    const userMessages = fullHistory.filter((m) => m.role === "user");
    if (userMessages.length === 1) {
      await autoTitleSession(session_id, userMessages[0].content);
    }

    /* Create the streaming response using full DB history (not just client-sent messages) */
    const stream = await chatStream(user!.id, fullHistory);

    /* Tee the stream: one copy goes to the client, the other collects for DB persistence */
    const [clientStream, dbStream] = stream.tee();

    /* Persist the full assistant response in the background */
    const persistPromise = (async () => {
      const reader = dbStream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        /* Parse SSE lines to extract text */
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) fullResponse += parsed.text;
            } catch {}
          }
        }
      }

      if (fullResponse) {
        await saveChatMessage(session_id, "assistant", fullResponse);
      }
    })();

    /* Don't block the response on DB persistence */
    persistPromise.catch((err) =>
      console.error("[POST /api/chat] Failed to persist assistant message:", err)
    );

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[POST /api/chat] Error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to process chat message" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
