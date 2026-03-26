#!/usr/bin/env node

/**
 * Orbit PRM — Setup-Only Script
 *
 * Creates ~/.orbit/.env (with auto-generated defaults) and initializes the
 * database, then exits.  Called by Install Orbit.bat before the Next.js
 * build so that the data directory is in place.
 *
 * API keys are NOT collected here — users enter them from the Settings
 * page inside the app after launch.
 *
 * If ~/.orbit/.env already exists, exits immediately (already set up).
 */

const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");

const ORBIT_DIR = path.join(os.homedir(), ".orbit");
const ENV_PATH = path.join(ORBIT_DIR, ".env");
const DB_PATH = path.join(ORBIT_DIR, "orbit.db");
const PORT = process.env.PORT || 3000;

/* ── Already configured? ── */
if (fs.existsSync(ENV_PATH)) {
  console.log("\n  Config already exists at " + ENV_PATH);
  console.log("  Skipping setup.\n");
  process.exit(0);
}

/* ── Create config & database ── */

if (!fs.existsSync(ORBIT_DIR)) {
  fs.mkdirSync(ORBIT_DIR, { recursive: true });
}

const encryptionKey = crypto.randomBytes(32).toString("hex");

const envContent = [
  "# Orbit PRM Configuration",
  `# Generated on ${new Date().toISOString()}`,
  "",
  "# OpenAI (required for AI features — add your key in Settings)",
  'OPENAI_API_KEY=""',
  "",
  "# Google OAuth (required for sync — add in Settings)",
  'GOOGLE_CLIENT_ID=""',
  'GOOGLE_CLIENT_SECRET=""',
  `GOOGLE_REDIRECT_URI="http://localhost:${PORT}/api/auth/google/callback"`,
  "",
  "# Exa (optional — for contact enrichment)",
  'EXA_API_KEY=""',
  "",
  "# Encryption (auto-generated — do not change)",
  `ENCRYPTION_KEY="${encryptionKey}"`,
  "",
].join("\n");

fs.writeFileSync(ENV_PATH, envContent, "utf-8");
console.log(`\n  Config created at ${ENV_PATH}`);

/* ── Initialize database ── */

const Database = require("better-sqlite3");
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

const now = new Date().toISOString();
sqlite
  .prepare(
    "INSERT OR IGNORE INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  )
  .run("local-user", "user@orbit.local", "Orbit User", now, now);
sqlite.close();

console.log("  Database initialized at ~/.orbit/orbit.db");
console.log("\n  Setup complete! Add your API keys in Settings after launching Orbit.\n");
