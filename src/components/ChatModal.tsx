"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Bot, Plus, Trash2, MessageSquare } from "lucide-react";
import { apiClient } from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hey! I'm Orbit Assistant. I can help you with your contacts, warmth scores, reminders, and relationship insights. What would you like to know?",
};

export default function ChatModal({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Auto-scroll to bottom */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /* Focus input on mount and session switch */
  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* Load sessions on mount */
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await apiClient.get<ChatSession[]>("/api/chat/sessions");
      setSessions(data);
      setSessionsLoaded(true);
    } catch {
      setSessionsLoaded(true);
    }
  };

  const createNewSession = async () => {
    try {
      const session = await apiClient.post<ChatSession>("/api/chat/sessions", {});
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([GREETING]);
    } catch {}
  };

  const loadSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setLoading(true);
    try {
      const msgs = await apiClient.get<ChatMessage[]>(
        `/api/chat/sessions/${sessionId}/messages`
      );
      setMessages(msgs.length > 0 ? msgs : [GREETING]);
    } catch {
      setMessages([GREETING]);
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/api/chat/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setMessages([GREETING]);
      }
    } catch {}
  };

  /* Get auth token for streaming fetch */
  const getToken = async (): Promise<string> => "";

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || streaming) return;

    /* Ensure we have a session */
    let sessionId = activeSessionId;
    if (!sessionId) {
      try {
        const session = await apiClient.post<ChatSession>("/api/chat/sessions", {});
        setSessions((prev) => [session, ...prev]);
        sessionId = session.id;
        setActiveSessionId(session.id);
      } catch {
        return;
      }
    }

    const userMessage: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    /* Add a placeholder assistant message that we'll stream into */
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const token = await getToken();

      /* Server loads full history from DB — only send the new user message */
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          messages: [userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error("Stream request failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                assistantText += parsed.text;
                /* Update the last message (the streaming placeholder) */
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      /* Refresh sessions to pick up auto-title */
      loadSessions();
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, loading, streaming, messages, activeSessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0d0d] border border-white/[0.1] rounded-2xl w-[700px] h-[620px] flex shadow-2xl overflow-hidden">
        {/* ── Chat History Sidebar ── */}
        <div className="w-[200px] shrink-0 border-r border-white/[0.06] flex flex-col">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
            <span className="text-[10px] uppercase tracking-widest text-white/45 font-medium">
              Chats
            </span>
            <button
              onClick={createNewSession}
              className="p-1 rounded text-white/25 hover:text-orange-400 transition-colors"
              title="New Chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {!sessionsLoaded ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-white/20" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 text-white/10" />
                <p className="text-[10px] text-white/20">No chats yet</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${
                    activeSessionId === session.id
                      ? "bg-white/[0.08] text-white/90"
                      : "text-white/45 hover:bg-white/[0.04] hover:text-white/70"
                  }`}
                >
                  <MessageSquare className="w-3 h-3 shrink-0" />
                  <span className="text-[11px] truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-0.5 rounded text-white/0 group-hover:text-white/20 hover:!text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Chat Area ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <span className="text-[13px] font-medium text-white/90">Orbit Assistant</span>
                <p className="text-[10px] text-white/30">PRM AI Assistant</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed break-words overflow-hidden ${
                    msg.role === "user"
                      ? "bg-orange-500/20 text-white/90 rounded-br-md"
                      : "bg-white/[0.06] text-white/70 rounded-bl-md"
                  }`}
                  style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                >
                  {msg.content
                    ? msg.content.split("\n").map((line, j) => (
                        <span key={j}>
                          {line}
                          {j < msg.content.split("\n").length - 1 && <br />}
                        </span>
                      ))
                    : streaming && i === messages.length - 1 && (
                        <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                      )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 focus-within:border-white/[0.15] transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about your contacts, warmth, reminders..."
                className="flex-1 bg-transparent border-none outline-none text-[13px] text-white/90 placeholder:text-white/25"
                disabled={loading || streaming}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || streaming}
                className="p-1.5 rounded-lg text-white/25 hover:text-orange-400 transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
