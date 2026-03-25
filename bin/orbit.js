#!/usr/bin/env node

/**
 * Orbit PRM — CLI Entry Point
 *
 * Usage:
 *   npx orbit-prm    (after npm install -g orbit-prm)
 *   orbit-prm         (global install)
 *
 * Flow:
 *   1. Check ~/.orbit/.env → first-run setup if missing
 *   2. Load env from ~/.orbit/.env
 *   3. Run DB migrations
 *   4. Start Next.js production server
 *   5. Open browser
 */

const path = require("path");
const os = require("os");
const fs = require("fs");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");

const ORBIT_DIR = path.join(os.homedir(), ".orbit");
const ENV_PATH = path.join(ORBIT_DIR, ".env");
const DB_PATH = path.join(ORBIT_DIR, "orbit.db");
const PROJECT_DIR = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3000;

/* ── First-run setup (pure JS, no tsx needed) ── */

async function runSetup() {
  /* prompts is a dependency of the package */
  const prompts = require("prompts");

  console.log("\n  Welcome to Orbit — Professional Relationship Manager\n");
  console.log("  Let's get you set up. This will only take a minute.\n");

  const response = await prompts([
    {
      type: "text",
      name: "name",
      message: "Your name",
      validate: (v) => v.trim().length > 0 || "Name is required",
    },
    {
      type: "text",
      name: "email",
      message: "Your email",
      validate: (v) => v.includes("@") || "Enter a valid email",
    },
    {
      type: "password",
      name: "openaiKey",
      message: "OpenAI API key (required for AI features)",
      validate: (v) => v.startsWith("sk-") || "Must start with sk-",
    },
    {
      type: "text",
      name: "googleClientId",
      message: "Google OAuth Client ID (for Gmail/Calendar sync)",
      validate: (v) => v.trim().length > 0 || "Required for sync",
    },
    {
      type: "password",
      name: "googleClientSecret",
      message: "Google OAuth Client Secret",
      validate: (v) => v.trim().length > 0 || "Required for sync",
    },
    {
      type: "text",
      name: "exaKey",
      message: "Exa API Key (Optional - For Enrichment, press Enter to skip)",
      initial: "",
    },
  ]);

  if (!response.name || !response.email || !response.openaiKey) {
    console.log("\n  Setup cancelled. Run orbit-prm again to retry.\n");
    process.exit(1);
  }

  const encryptionKey = crypto.randomBytes(32).toString("hex");

  if (!fs.existsSync(ORBIT_DIR)) {
    fs.mkdirSync(ORBIT_DIR, { recursive: true });
  }

  const envContent = [
    "# Orbit PRM Configuration",
    `# Generated on ${new Date().toISOString()}`,
    "",
    "# User",
    `ORBIT_USER_NAME="${response.name}"`,
    `ORBIT_USER_EMAIL="${response.email}"`,
    "",
    "# OpenAI (required)",
    `OPENAI_API_KEY="${response.openaiKey}"`,
    "",
    "# Google OAuth (required for sync)",
    `GOOGLE_CLIENT_ID="${response.googleClientId}"`,
    `GOOGLE_CLIENT_SECRET="${response.googleClientSecret}"`,
    `GOOGLE_REDIRECT_URI="http://localhost:${PORT}/api/auth/google/callback"`,
    "",
    "# Exa (optional)",
    `EXA_API_KEY="${response.exaKey || ""}"`,
    "",
    "# Encryption (auto-generated)",
    `ENCRYPTION_KEY="${encryptionKey}"`,
    "",
  ].join("\n");

  fs.writeFileSync(ENV_PATH, envContent, "utf-8");
  console.log(`\n  Config saved to ${ENV_PATH}`);

  /* Create DB + tables + local user */
  runMigrations();
  insertLocalUser(response.name, response.email);

  console.log("  Database initialized at ~/.orbit/orbit.db");
  console.log("\n  Setup complete!\n");
}

/* ── Database migrations (pure JS, no drizzle needed) ── */

function runMigrations() {
  if (!fs.existsSync(ORBIT_DIR)) {
    fs.mkdirSync(ORBIT_DIR, { recursive: true });
  }

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

  sqlite.close();
}

function insertLocalUser(name, email) {
  const Database = require("better-sqlite3");
  const sqlite = new Database(DB_PATH);
  const now = new Date().toISOString();
  sqlite
    .prepare(
      "INSERT OR REPLACE INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run("local-user", email, name, now, now);
  sqlite.close();
}

/* ── Main ── */

async function main() {
  console.log("\n  \u2604\uFE0F  Orbit — Professional Relationship Manager\n");

  /* Step 1: First-run setup */
  if (!fs.existsSync(ENV_PATH)) {
    await runSetup();
  }

  /* Step 2: Load env */
  require("dotenv").config({ path: ENV_PATH });
  console.log("  \u2713 Loaded config from ~/.orbit/.env");

  /* Step 3: Ensure DB is migrated */
  runMigrations();
  console.log("  \u2713 Database ready");

  /* Step 4: Check if Next.js is built */
  const nextDir = path.join(PROJECT_DIR, ".next");
  if (!fs.existsSync(nextDir)) {
    console.log("  Building Orbit (first time only, may take a minute)...\n");
    try {
      const buildBin = path.join(PROJECT_DIR, "node_modules", "next", "dist", "bin", "next");
      execSync(`"${process.execPath}" "${buildBin}" build`, {
        cwd: PROJECT_DIR,
        stdio: "inherit",
        env: { ...process.env },
      });
    } catch (err) {
      console.error("\n  Build failed. Check the errors above.");
      process.exit(1);
    }
  }

  /* Step 5: Start Next.js production server */
  console.log(`\n  Starting Orbit on http://localhost:${PORT}...\n`);

  const nextBin = path.join(PROJECT_DIR, "node_modules", "next", "dist", "bin", "next");
  const nextProcess = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: PROJECT_DIR,
    stdio: "inherit",
    env: { ...process.env },
  });

  /* Step 6: Open browser */
  setTimeout(async () => {
    try {
      const open = (await import("open")).default;
      await open(`http://localhost:${PORT}`);
    } catch {
      console.log(`  Open http://localhost:${PORT} in your browser.`);
    }
  }, 2000);

  /* Graceful shutdown */
  const shutdown = () => {
    console.log("\n  Shutting down Orbit...");
    nextProcess.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  nextProcess.on("close", (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error("  Fatal error:", err.message || err);
  process.exit(1);
});
