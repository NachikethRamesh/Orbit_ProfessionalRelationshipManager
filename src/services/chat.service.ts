import { getOpenAI } from "@/lib/openai";
import { getDb } from "@/lib/db";
import { chatSessions, chatMessages, contacts, reminders, interactions, suggestions } from "@/lib/db/schema";
import { eq, and, desc, asc, or, like } from "drizzle-orm";
import crypto from "crypto";
import { createReminder, updateReminder as updateReminderService } from "@/services/reminders.service";
import { createContact, updateContact, deleteContact } from "@/services/contacts.service";

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

/* ── OpenAI Tool Definitions ── */

const TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "Create a new reminder. Optionally link to a contact by name or email.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "What to be reminded about" },
          remind_at: { type: "string", description: "ISO 8601 date-time for when to remind (e.g. 2026-04-01T09:00:00Z)" },
          contact_name_or_email: { type: "string", description: "Name or email of the contact to link (optional)" },
        },
        required: ["title", "remind_at"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reminder",
      description: "Update an existing reminder — change its status (completed/dismissed/pending) or reschedule it.",
      parameters: {
        type: "object",
        properties: {
          reminder_title: { type: "string", description: "Title (or partial title) of the reminder to update" },
          status: { type: "string", enum: ["pending", "completed", "dismissed"], description: "New status" },
          remind_at: { type: "string", description: "New ISO 8601 date-time to reschedule to" },
        },
        required: ["reminder_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reminder",
      description: "Delete (dismiss) a reminder by its title.",
      parameters: {
        type: "object",
        properties: {
          reminder_title: { type: "string", description: "Title (or partial title) of the reminder to dismiss" },
        },
        required: ["reminder_title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Create a new contact in the PRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name" },
          email: { type: "string", description: "Email address" },
          company: { type: "string", description: "Company name" },
          title: { type: "string", description: "Job title" },
          phone: { type: "string", description: "Phone number" },
          location: { type: "string", description: "Location" },
          linkedin_url: { type: "string", description: "LinkedIn profile URL" },
        },
        required: ["name", "email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Update an existing contact's fields (company, title, phone, location, linkedin, warmth_score, starred).",
      parameters: {
        type: "object",
        properties: {
          contact_name_or_email: { type: "string", description: "Name or email of the contact to update" },
          name: { type: "string" },
          email: { type: "string" },
          company: { type: "string" },
          title: { type: "string" },
          phone: { type: "string" },
          location: { type: "string" },
          linkedin_url: { type: "string" },
          twitter_url: { type: "string" },
          warmth_score: { type: "number", description: "0-100" },
          starred: { type: "boolean" },
        },
        required: ["contact_name_or_email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description: "Permanently delete a contact from the PRM.",
      parameters: {
        type: "object",
        properties: {
          contact_name_or_email: { type: "string", description: "Name or email of the contact to delete" },
        },
        required: ["contact_name_or_email"],
      },
    },
  },
];

/* ── Tool Execution ── */

function findContactByNameOrEmail(userId: string, nameOrEmail: string) {
  const db = getDb();
  const pattern = `%${nameOrEmail}%`;
  return db.select({ id: contacts.id, name: contacts.name, email: contacts.email })
    .from(contacts)
    .where(and(
      eq(contacts.user_id, userId),
      or(like(contacts.name, pattern), like(contacts.email, pattern)),
    ))
    .limit(1)
    .get();
}

function findReminderByTitle(userId: string, title: string) {
  const db = getDb();
  const pattern = `%${title}%`;
  return db.select({
    id: reminders.id, title: reminders.title, status: reminders.status,
  })
    .from(reminders)
    .where(and(eq(reminders.user_id, userId), like(reminders.title, pattern)))
    .limit(1)
    .get();
}

async function executeTool(userId: string, name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "create_reminder": {
        let contactId: string | null = null;
        if (args.contact_name_or_email) {
          const contact = findContactByNameOrEmail(userId, args.contact_name_or_email);
          contactId = contact?.id ?? null;
        }
        const reminder = await createReminder({
          user_id: userId,
          contact_id: contactId ?? "",
          title: args.title,
          remind_at: args.remind_at,
          status: "pending",
          suggestion_id: "",
        });
        return JSON.stringify({ success: true, reminder: { id: reminder.id, title: reminder.title, remind_at: reminder.remind_at } });
      }

      case "update_reminder": {
        const found = findReminderByTitle(userId, args.reminder_title);
        if (!found) return JSON.stringify({ success: false, error: `No reminder found matching "${args.reminder_title}"` });
        const updates: any = {};
        if (args.status) updates.status = args.status;
        if (args.remind_at) updates.remind_at = args.remind_at;
        await updateReminderService(userId, found.id, updates);
        return JSON.stringify({ success: true, updated: { id: found.id, title: found.title, ...updates } });
      }

      case "delete_reminder": {
        const found = findReminderByTitle(userId, args.reminder_title);
        if (!found) return JSON.stringify({ success: false, error: `No reminder found matching "${args.reminder_title}"` });
        await updateReminderService(userId, found.id, { status: "dismissed" });
        return JSON.stringify({ success: true, dismissed: { id: found.id, title: found.title } });
      }

      case "create_contact": {
        const contact = await createContact(userId, {
          name: args.name,
          email: args.email,
          company: args.company ?? "",
          title: args.title ?? "",
          phone: args.phone ?? "",
          location: args.location ?? "",
          linkedin_url: args.linkedin_url ?? "",
        });
        return JSON.stringify({ success: true, contact: { id: contact.id, name: contact.name, email: contact.email } });
      }

      case "update_contact": {
        const contact = findContactByNameOrEmail(userId, args.contact_name_or_email);
        if (!contact) return JSON.stringify({ success: false, error: `No contact found matching "${args.contact_name_or_email}"` });
        const { contact_name_or_email, ...fields } = args;
        await updateContact(userId, contact.id, fields);
        return JSON.stringify({ success: true, updated: { id: contact.id, name: contact.name, ...fields } });
      }

      case "delete_contact": {
        const contact = findContactByNameOrEmail(userId, args.contact_name_or_email);
        if (!contact) return JSON.stringify({ success: false, error: `No contact found matching "${args.contact_name_or_email}"` });
        await deleteContact(userId, contact.id);
        return JSON.stringify({ success: true, deleted: { id: contact.id, name: contact.name, email: contact.email } });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err.message ?? String(err) });
  }
}

/* ── System Prompt Builder ── */

async function buildSystemPrompt(userId: string): Promise<string> {
  const db = getDb();

  const allContacts = db.select({
    id: contacts.id, name: contacts.name, email: contacts.email,
    company: contacts.company, title: contacts.title,
    linkedin_url: contacts.linkedin_url, twitter_url: contacts.twitter_url,
    phone: contacts.phone, location: contacts.location,
    other_emails: contacts.other_emails, starred: contacts.starred,
    warmth_score: contacts.warmth_score, created_at: contacts.created_at,
    updated_at: contacts.updated_at,
  }).from(contacts)
    .where(eq(contacts.user_id, userId))
    .orderBy(desc(contacts.warmth_score))
    .all();

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
    .map((c) => {
      const parts = [`- ${c.name || "Unknown"} (${c.email})`];
      if (c.company) parts.push(`company: ${c.company}`);
      if (c.title) parts.push(`title: ${c.title}`);
      parts.push(`warmth: ${c.warmth_score}`);
      if (c.starred) parts.push("starred");
      if (c.phone) parts.push(`phone: ${c.phone}`);
      if (c.location) parts.push(`location: ${c.location}`);
      if (c.linkedin_url) parts.push(`linkedin: ${c.linkedin_url}`);
      if (c.twitter_url) parts.push(`twitter: ${c.twitter_url}`);
      const otherEmails = Array.isArray(c.other_emails) && c.other_emails.length > 0
        ? c.other_emails : null;
      if (otherEmails) parts.push(`other emails: ${otherEmails.join(", ")}`);
      if (c.created_at) parts.push(`added: ${c.created_at.slice(0, 10)}`);
      return parts.join(" | ");
    })
    .join("\n");

  const reminderList = pendingReminders
    .map((r) => {
      const contactName = allContacts.find((c) => c.id === r.contact_id)?.name;
      return `- "${r.title}" due ${r.remind_at}${contactName ? ` (for ${contactName})` : ""}`;
    })
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

  return `You are Orbit Assistant, the AI helper inside a professional relationship management app called "Orbit".

YOUR SCOPE — you ONLY help with PRM and contact-related tasks:
• Filtering, searching, or sorting contacts (by warmth, company, recency, tags, etc.)
• Relationship insights — who's warm, who's cold, who needs attention
• Reminder suggestions — when to follow up, who to reach out to
• Summarizing interaction history with a specific contact
• Answering questions about the user's network, suggestions, or reminders
• Helping draft follow-up ideas or outreach strategies
• Creating, updating, and deleting reminders and contacts when the user asks

ACTIONS — You have tools to create/update/delete reminders and contacts. USE THEM when the user asks you to:
• Create a reminder → call create_reminder
• Complete, dismiss, or reschedule a reminder → call update_reminder or delete_reminder
• Add a new contact → call create_contact
• Update a contact's info → call update_contact
• Delete a contact → call delete_contact
Always confirm what you did after executing an action.

REFUSAL — If the user asks about anything NOT related to their contacts, relationships, PRM, or networking, politely decline:
"I'm focused on helping you manage your relationships and contacts. I can't help with that, but I can help you with things like filtering contacts, checking warmth scores, or suggesting follow-ups!"

CONVERSATION CONTEXT — You have access to the full conversation history. Always relate your answers to what was previously discussed.

FORMATTING — You MUST follow these rules for EVERY response:
• Always respond using bullet points. Every piece of information must be a bullet point.
• Keep each bullet concise — one idea per bullet.
• Use a short introductory line before the bullets only when needed for context.
• Do not use markdown headers (#, ##, etc.).
• Do not write long paragraphs. If a response has more than one sentence, break it into bullets.
• For follow-up suggestions or action items, prefix with an action verb (e.g., "Reach out to…", "Schedule a…", "Review…").

PRM CONTEXT (live data):
Total contacts: ${totalContacts} | Warm (>=70): ${warmContacts} | Cold (<30): ${coldContacts}

Contacts (all):
${contactList || "No contacts yet."}

Pending reminders:
${reminderList || "No pending reminders."}

Recent interactions (last 30):
${interactionList || "No recent interactions."}

Pending suggestions:
${suggestionList || "No pending suggestions."}

Use this context to answer accurately. Reference specific contacts by name when relevant.`;
}

/* ── Chat Stream with Tool Calling ── */

export async function chatStream(userId: string, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
  const systemPrompt = await buildSystemPrompt(userId);
  const openai = getOpenAI();

  const openaiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  /* Loop: call OpenAI, execute any tool calls, repeat until we get a text response */
  let maxIterations = 5;
  while (maxIterations-- > 0) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: openaiMessages,
      max_tokens: 4096,
      temperature: 0.5,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      /* No tool calls — we have the final text response. Stream it. */
      const finalText = assistantMessage.content ?? "";
      const encoder = new TextEncoder();

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          /* Stream the final response in small chunks for a typing effect */
          const chunkSize = 4;
          for (let i = 0; i < finalText.length; i += chunkSize) {
            const text = finalText.slice(i, i + chunkSize);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
    }

    /* Tool calls present — execute them and feed results back */
    openaiMessages.push(assistantMessage);

    for (const toolCall of assistantMessage.tool_calls) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {}

      const result = await executeTool(userId, toolCall.function.name, args);

      openaiMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      });
    }
  }

  /* Fallback if we exhaust iterations */
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: "I completed the actions but couldn't generate a summary. Please check your reminders and contacts." })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
