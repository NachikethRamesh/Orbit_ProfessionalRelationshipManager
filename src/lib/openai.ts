/**
 * OpenAI Client (Server-only)
 *
 * Creates an OpenAI client that always reads the API key from
 * ~/.orbit/.env so it picks up keys saved via Settings without
 * requiring a server restart.
 *
 * DO NOT import this module from client components — the API key
 * must never be exposed to the browser.
 */
import OpenAI from "openai";
import { getEnv } from "@/lib/env";

/**
 * Returns a fresh OpenAI client using the latest key from disk.
 * Throws a clear error if OPENAI_API_KEY is missing at call time.
 */
export function getOpenAI(): OpenAI {
  const apiKey = getEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it in Settings.");
  }
  return new OpenAI({ apiKey });
}
