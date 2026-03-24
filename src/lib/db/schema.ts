import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import crypto from "crypto";

// ─── Users ───────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  name: text("name"),
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Connected Accounts ──────────────────────────────

export const connectedAccounts = sqliteTable("connected_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("google"),
  account_email: text("account_email").notNull(),
  google_access_token: text("google_access_token"),
  google_refresh_token: text("google_refresh_token"),
  gmail_sync_cursor: text("gmail_sync_cursor"),
  calendar_sync_cursor: text("calendar_sync_cursor"),
  connected_at: text("connected_at").$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueAccount: uniqueIndex("uq_connected_accounts").on(table.user_id, table.provider, table.account_email),
}));

// ─── Contacts ────────────────────────────────────────

export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  title: text("title"),
  linkedin_url: text("linkedin_url"),
  twitter_url: text("twitter_url"),
  phone: text("phone"),
  location: text("location"),
  other_emails: text("other_emails", { mode: "json" }).$type<string[]>().default([]),
  starred: integer("starred", { mode: "boolean" }).default(false),
  warmth_score: integer("warmth_score").default(50),
  exa_data: text("exa_data", { mode: "json" }).$type<Record<string, unknown> | null>(),
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueUserEmail: uniqueIndex("uq_contacts_user_email").on(table.user_id, table.email),
}));

// ─── Contact Tags ────────────────────────────────────

export const contactTags = sqliteTable("contact_tags", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  contact_id: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
}, (table) => ({
  uniqueContactTag: uniqueIndex("uq_contact_tags").on(table.contact_id, table.tag),
}));

// ─── Interactions ────────────────────────────────────

export const interactions = sqliteTable("interactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contact_id: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'email_sent' | 'email_received' | 'meeting'
  source_id: text("source_id"),
  subject: text("subject"),
  snippet: text("snippet"),
  body_text: text("body_text"),
  ai_summary: text("ai_summary"),
  occurred_at: text("occurred_at").notNull(),
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  uniqueSourceId: uniqueIndex("uq_interactions_source").on(table.user_id, table.source_id),
}));

// ─── Suggestions ─────────────────────────────────────

export const suggestions = sqliteTable("suggestions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contact_id: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'follow_up' | 'thank_you' | 'check_in' | 'drop_email' | 'pre_meeting_brief'
  title: text("title").notNull(),
  body: text("body"),
  priority: integer("priority").default(0),
  status: text("status").default("pending"), // 'pending' | 'accepted' | 'dismissed' | 'snoozed'
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Reminders ───────────────────────────────────────

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contact_id: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  suggestion_id: text("suggestion_id").references(() => suggestions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  remind_at: text("remind_at").notNull(),
  status: text("status").default("pending"), // 'pending' | 'completed' | 'dismissed'
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Deleted Contacts ────────────────────────────────

export const deletedContacts = sqliteTable("deleted_contacts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
}, (table) => ({
  uniqueDeletedEmail: uniqueIndex("uq_deleted_contacts").on(table.user_id, table.email),
}));

// ─── Chat Sessions ───────────────────────────────────

export const chatSessions = sqliteTable("chat_sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").default("New Chat"),
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Chat Messages ───────────────────────────────────

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  session_id: text("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  created_at: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── Relations ───────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  connectedAccounts: many(connectedAccounts),
  interactions: many(interactions),
  suggestions: many(suggestions),
  reminders: many(reminders),
  chatSessions: many(chatSessions),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, { fields: [contacts.user_id], references: [users.id] }),
  tags: many(contactTags),
  interactions: many(interactions),
  suggestions: many(suggestions),
  reminders: many(reminders),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, { fields: [contactTags.contact_id], references: [contacts.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  user: one(users, { fields: [interactions.user_id], references: [users.id] }),
  contact: one(contacts, { fields: [interactions.contact_id], references: [contacts.id] }),
}));

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  user: one(users, { fields: [suggestions.user_id], references: [users.id] }),
  contact: one(contacts, { fields: [suggestions.contact_id], references: [contacts.id] }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  user: one(users, { fields: [reminders.user_id], references: [users.id] }),
  contact: one(contacts, { fields: [reminders.contact_id], references: [contacts.id] }),
  suggestion: one(suggestions, { fields: [reminders.suggestion_id], references: [suggestions.id] }),
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one }) => ({
  user: one(users, { fields: [connectedAccounts.user_id], references: [users.id] }),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, { fields: [chatSessions.user_id], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.session_id], references: [chatSessions.id] }),
}));
