import { getOpenAI } from "@/lib/openai";
import { getDb } from "@/lib/db";
import { chatSessions, chatMessages, contacts, reminders, interactions, suggestions } from "@/lib/db/schema";
import { eq, and, desc, asc, gte, lt } from "drizzle-orm";
import crypto from "crypto";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function listChatSessions(userId: string): Promise<ChatSession[]> {
  const db = getDb();
  return db.select({ id: chatSessions.id, title: chatSessions.title, created_at: chatSessions.created_at, updated_at: chatSessions.updated_at })
    .from(chatSessions)
    .where(eq(chatSessions.user_id, userId))
    .orderBy(desc(chatSessions.updated_at))
    .limit(50)
    .all() as ChatSession[];
}

export async function createChatSession(userId: string, title: string = "New Chat"): Promise<ChatSession> {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.insert(chatSessions).values({ id, user_id: userId, title, created_at: now, updated_at: now }).run();

  return { id, title, created_at: now, updated_at: now };
}

export async function deleteChatSession(userId: string, sessionId: string): Promise<void> {
  const db = getDb();
  db.delete(chatSessions).where(and(eq(chatSessions.id, sessionId), eq(chatSessions.user_id, userId))).run();
}

export async function loadChatMessages(userId: string, sessionId: string): Promise<ChatMessage[]> {
  const db = getDb();

  const session = db.select({ id: chatSessions.id }).from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.user_id, userId))).get();

  if (!session) throw new Error("Session not found");

  const messages = db.select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.session_id, sessionId))
    .orderBy(asc(chatMessages.created_at))
    .all();

  return messages as ChatMessage[];
}

export async function saveChatMessage(sessionId: string, role: "user" | "assistant", content: string): Promise<void> {
  const db = getDb();

  db.insert(chatMessages).values({
    id: crypto.randomUUID(),
    session_id: sessionId,
    role,
    content,
  }).run();

  db.update(chatSessions).set({ updated_at: new Date().toISOString() }).where(eq(chatSessions.id, sessionId)).run();
}

export async function autoTitleSession(sessionId: string, firstMessage: string): Promise<void> {
  const db = getDb();
  const title = firstMessage.length > 50 ? firstMessage.slice(0, 47) + "..." : firstMessage;
  db.update(chatSessions).set({ title }).where(eq(chatSessions.id, sessionId)).run();
}

async function buildSystemPrompt(userId: string): Promise<string> {
  const db = getDb();

  const allContacts = db.select({
    id: contacts.id, name: contacts.name, email: contacts.email,
    company: contacts.company, title: contacts.title,
    warmth_score: contacts.warmth_score, updated_at: contacts.updated_at,
  }).from(contacts)
    .where(eq(contacts.user_id, userId))
    .orderBy(desc(contacts.warmth_score))
    .limit(100).all();

  const pendingReminders = db.select({
    id: reminders.id, title: reminders.title, remind_at: reminders.remind_at,
    status: reminders.status, contact_id: reminders.contact_id,
  }).from(reminders)
    .where(and(eq(reminders.user_id, userId), eq(reminders.status, "pending")))
    .orderBy(asc(reminders.remind_at))
    .limit(20).all();

  const recentInteractions = db.select({
    id: interactions.id, contact_id: interactions.contact_id, type: interactions.type,
    subject: interactions.subject, snippet: interactions.snippet, occurred_at: interactions.occurred_at,
  }).from(interactions)
    .where(eq(interactions.user_id, userId))
    .orderBy(desc(interactions.occurred_at))
    .limit(30).all();

  const pendingSuggestions = db.select({
    id: suggestions.id, contact_id: suggestions.contact_id, type: suggestions.type,
    title: suggestions.title, body: suggestions.body, priority: suggestions.priority,
    status: suggestions.status,
  }).from(suggestions)
    .where(and(eq(suggestions.user_id, userId), eq(suggestions.status, "pending")))
    .orderBy(desc(suggestions.priority))
    .limit(15).all();

  const contactList = allContacts
    .map((c) => `- ${c.name} (${c.email}) | ${c.company || "no company"} | ${c.title || "no title"} | warmth: ${c.warmth_score}`)
    .join("\n");

  const reminderList = pendingReminders
    .map((r) => `- "${r.title}" due ${r.remind_at} (status: ${r.status})`)
    .join("\n");

  const interactionList = recentInteractions
    .map((i) => {
      const contactName = allContacts.find((c) => c.id === i.contact_id)?.name ?? "Unknown";
      return `- [${i.occurred_at}] ${i.type} with ${contactName}: "${i.subject}"`;
    })
    .join("\n");

  const suggestionList = pendingSuggestions
    .map((s) => {
      const contactName = allContacts.find((c) => c.id === s.contact_id)?.name ?? "Unknown";
      return `- [${s.type}] ${s.title} (for ${contactName}, priority: ${s.priority})`;
    })
    .join("\n");

  const totalContacts = allContacts.length;
  const warmContacts = allContacts.filter((c) => (c.warmth_score ?? 0) >= 70).length;
  const coldContacts = allContacts.filter((c) => (c.warmth_score ?? 0) < 30).length;

  return `You are Orbit Assistant, the AI helper inside a personal CRM app called "Orbit".

YOUR SCOPE — you ONLY help with CRM and contact-related tasks:
• Filtering, searching, or sorting contacts (by warmth, company, recency, tags, etc.)
• Relationship insights — who's warm, who's cold, who needs attention
• Reminder suggestions — when to follow up, who to reach out to
• Summarizing interaction history with a specific contact
• Answering questions about the user's network, suggestions, or reminders
• Helping draft follow-up ideas or outreach strategies

REFUSAL — If the user asks about anything NOT related to their contacts, relationships, CRM, or networking, politely decline:
"I'm focused on helping you manage your relationships and contacts. I can't help with that, but I can help you with things like filtering contacts, checking warmth scores, or suggesting follow-ups!"

CONVERSATION CONTEXT — You have access to the full conversation history. Always relate your answers to what was previously discussed.

FORMATTING — Keep responses concise but thorough. Use bullet points for lists. Do not use markdown headers.

CRM CONTEXT (live data):
Total contacts: ${totalContacts} | Warm (≥70): ${warmContacts} | Cold (<30): ${coldContacts}

Contacts (up to 100):
${contactList || "No contacts yet."}

Pending reminders:
${reminderList || "No pending reminders."}

Recent interactions (last 30):
${interactionList || "No recent interactions."}

Pending suggestions:
${suggestionList || "No pending suggestions."}

Use this context to answer accurately. Reference specific contacts by name when relevant.`;
}

export async function chatStream(userId: string, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = await buildSystemPrompt(userId);

  const openaiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  const stream = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: openaiMessages,
    max_tokens: 4096,
    temperature: 0.5,
    stream: true,
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
