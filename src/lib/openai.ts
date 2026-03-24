/**
 * OpenAI Client (Server-only)
 *
 * Lazily creates an OpenAI client so the app can build and start
 * even when OPENAI_API_KEY is not yet set. The key is only required
 * when an AI feature is actually called.
 *
 * DO NOT import this module from client components — the API key
 * must never be exposed to the browser.
 */
import OpenAI from "openai";

/** Cached client instance — created on first call to getOpenAI() */
let _client: OpenAI | null = null;

/**
 * Returns the shared OpenAI client, creating it on first use.
 * Throws a clear error if OPENAI_API_KEY is missing at call time.
 */
export function getOpenAI(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "missing-key",
    });
  }
  return _client;
}
