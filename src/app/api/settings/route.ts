import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/app/api/_helpers/auth";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const ENV_PATH = path.join(os.homedir(), ".orbit", ".env");
const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

/** Keys that can be edited from the UI */
const EDITABLE_KEYS = [
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "EXA_API_KEY",
  "ENCRYPTION_KEY",
] as const;

function parseEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function maskValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return value.slice(0, 4) + "*".repeat(value.length - 8) + value.slice(-4);
}

/** Write auto-generated defaults back to the env file */
function writeDefaults(env: Record<string, string>) {
  const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
  const lines = content.split("\n");
  const existing = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex !== -1) existing.add(trimmed.slice(0, eqIndex).trim());
  }
  for (const key of ["GOOGLE_REDIRECT_URI", "ENCRYPTION_KEY"] as const) {
    if (!existing.has(key) && env[key]) {
      lines.push(`${key}="${env[key]}"`);
    }
  }
  const dir = path.dirname(ENV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ENV_PATH, lines.join("\n"), "utf-8");
}

/** GET — return current config with masked secrets */
export async function GET(req: NextRequest) {
  const { error } = await getAuthUser(req);
  if (error) return error;

  const env = parseEnvFile();

  /* Auto-populate defaults if missing */
  let dirty = false;
  if (!env.GOOGLE_REDIRECT_URI) {
    env.GOOGLE_REDIRECT_URI = DEFAULT_REDIRECT_URI;
    dirty = true;
  }
  if (!env.ENCRYPTION_KEY) {
    env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
    dirty = true;
  }
  if (dirty) {
    writeDefaults(env);
  }

  /** Keys that should never be masked (user needs to copy them) */
  const VISIBLE_KEYS = new Set(["GOOGLE_REDIRECT_URI"]);

  const settings: Record<string, string> = {};
  for (const key of EDITABLE_KEYS) {
    settings[key] = env[key]
      ? VISIBLE_KEYS.has(key) ? env[key] : maskValue(env[key])
      : "";
  }

  return NextResponse.json({ settings });
}

/** PATCH — update one or more keys */
export async function PATCH(req: NextRequest) {
  const { error } = await getAuthUser(req);
  if (error) return error;

  const body = await req.json();
  const updates: Record<string, string> = body.updates;

  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "Missing updates object" }, { status: 400 });
  }

  /* Read full env file to preserve comments and non-editable keys */
  const content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
  const lines = content.split("\n");

  const keysUpdated = new Set<string>();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return line;
    const key = trimmed.slice(0, eqIndex).trim();
    if (key in updates && EDITABLE_KEYS.includes(key as any)) {
      keysUpdated.add(key);
      return `${key}="${updates[key]}"`;
    }
    return line;
  });

  /* Append any keys that weren't found in the file */
  for (const [key, value] of Object.entries(updates)) {
    if (!keysUpdated.has(key) && EDITABLE_KEYS.includes(key as any)) {
      newLines.push(`${key}="${value}"`);
    }
  }

  fs.writeFileSync(ENV_PATH, newLines.join("\n"), "utf-8");

  /* Reload the entire env file into process.env so ALL keys take effect instantly */
  const env = parseEnvFile();
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
  const settings: Record<string, string> = {};
  for (const k of EDITABLE_KEYS) {
    settings[k] = env[k] ? maskValue(env[k]) : "";
  }

  return NextResponse.json({ settings, message: "Settings updated." });
}
