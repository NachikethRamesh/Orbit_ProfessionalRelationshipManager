import Database from "better-sqlite3";
import { DB_PATH, ORBIT_DIR } from "./index";
import fs from "fs";

/**
 * Auto-migration: creates all tables if they don't exist.
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on every startup.
 */
export function runMigrations() {
  if (!fs.existsSync(ORBIT_DIR)) {
    fs.mkdirSync(ORBIT_DIR, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS connected_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'google',
      account_email TEXT NOT NULL,
      google_access_token TEXT,
      google_refresh_token TEXT,
      gmail_sync_cursor TEXT,
      calendar_sync_cursor TEXT,
      connected_at TEXT,
      updated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_connected_accounts ON connected_accounts(user_id, provider, account_email);

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      name TEXT,
      company TEXT,
      title TEXT,
      linkedin_url TEXT,
      twitter_url TEXT,
      phone TEXT,
      location TEXT,
      other_emails TEXT DEFAULT '[]',
      starred INTEGER DEFAULT 0,
      warmth_score INTEGER DEFAULT 50,
      exa_data TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_user_email ON contacts(user_id, email);
    CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_user_warmth ON contacts(user_id, warmth_score);

    CREATE TABLE IF NOT EXISTS contact_tags (
      id TEXT PRIMARY KEY,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_contact_tags ON contact_tags(contact_id, tag);

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      source_id TEXT,
      subject TEXT,
      snippet TEXT,
      body_text TEXT,
      ai_summary TEXT,
      occurred_at TEXT NOT NULL,
      created_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_interactions_source ON interactions(user_id, source_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
    CREATE INDEX IF NOT EXISTS idx_interactions_user_occurred ON interactions(user_id, occurred_at);

    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_suggestions_user_status ON suggestions(user_id, status);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
      suggestion_id TEXT REFERENCES suggestions(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      remind_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_user_status ON reminders(user_id, status, remind_at);

    CREATE TABLE IF NOT EXISTS deleted_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_deleted_contacts ON deleted_contacts(user_id, email);

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'New Chat',
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT
    );
  `);

  sqlite.close();
}
