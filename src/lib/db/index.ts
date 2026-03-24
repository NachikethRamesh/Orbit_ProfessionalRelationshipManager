import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import os from "os";
import fs from "fs";

const ORBIT_DIR = path.join(os.homedir(), ".orbit");
const DB_PATH = path.join(ORBIT_DIR, "orbit.db");

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  // Ensure the .orbit directory exists
  if (!fs.existsSync(ORBIT_DIR)) {
    fs.mkdirSync(ORBIT_DIR, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);

  // Enable WAL mode and foreign keys
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });
  return _db;
}

export { DB_PATH, ORBIT_DIR };

// Re-export schema for convenience
export * from "./schema";
