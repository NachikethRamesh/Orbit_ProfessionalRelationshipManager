/**
 * Reads a key directly from ~/.orbit/.env every time.
 *
 * We cannot trust process.env because orbit.js spawns Next.js as a
 * child process with a snapshot of env taken at startup — before the
 * user has entered their keys via Settings.  Reading the file ensures
 * we always get the latest saved value.
 */

import fs from "fs";
import path from "path";
import os from "os";

const ENV_PATH = path.join(os.homedir(), ".orbit", ".env");

export function getEnv(key: string): string {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const k = trimmed.slice(0, eqIndex).trim();
      if (k !== key) continue;
      let v = trimmed.slice(eqIndex + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return v;
    }
  } catch {}
  return "";
}
