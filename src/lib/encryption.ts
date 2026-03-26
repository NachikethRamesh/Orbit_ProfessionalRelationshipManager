/**
 * AES-256-GCM Encryption Utilities (Server-only)
 *
 * Used to encrypt sensitive data at rest (e.g., Google OAuth tokens)
 * before storing them in the database. Uses Node.js built-in crypto
 * module — do NOT import this from client components.
 *
 * Encrypted format: "iv:authTag:ciphertext" (all hex-encoded)
 *   - iv       = 12-byte initialization vector (unique per encryption)
 *   - authTag  = 16-byte authentication tag (integrity check)
 *   - ciphertext = the encrypted data
 */
import crypto from "crypto";
import { getEnv } from "@/lib/env";

/* Algorithm constants */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes is the recommended IV length for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes for the authentication tag

/**
 * Reads the 32-byte hex encryption key from ~/.orbit/.env.
 * Throws immediately if the key is missing or malformed.
 */
function getKey(): Buffer {
  const hex = getEnv("ENCRYPTION_KEY");
  if (!hex) {
    throw new Error("ENCRYPTION_KEY is not set. Run setup first.");
  }
  /* Convert the hex string to a 32-byte buffer */
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars). Got ${key.length} bytes.`
    );
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Steps:
 *  1. Generate a random 12-byte IV (ensures each encryption is unique).
 *  2. Create a cipher with the key and IV.
 *  3. Encrypt the plaintext and finalize.
 *  4. Extract the authentication tag (proves data wasn't tampered with).
 *  5. Return "iv:authTag:ciphertext" in hex format.
 *
 * @param plaintext - The string to encrypt.
 * @returns The encrypted string in "iv:authTag:ciphertext" hex format.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();

  /* Step 1: Generate a random initialization vector */
  const iv = crypto.randomBytes(IV_LENGTH);

  /* Step 2: Create the cipher */
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  /* Step 3: Encrypt the plaintext */
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  /* Step 4: Get the authentication tag */
  const authTag = cipher.getAuthTag();

  /* Step 5: Combine iv, authTag, and ciphertext into a single string */
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted with the encrypt() function above.
 *
 * Steps:
 *  1. Split the "iv:authTag:ciphertext" string into its parts.
 *  2. Convert each hex part back into a Buffer.
 *  3. Create a decipher with the key and IV.
 *  4. Set the authentication tag (GCM will verify data integrity).
 *  5. Decrypt and return the original plaintext.
 *
 * @param encryptedText - The encrypted string in "iv:authTag:ciphertext" format.
 * @returns The original plaintext string.
 * @throws If the data has been tampered with or the key is wrong.
 */
export function decrypt(encryptedText: string): string {
  const key = getKey();

  /* Step 1: Split the encrypted string into its three hex components */
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted text format. Expected 'iv:authTag:ciphertext'."
    );
  }

  /* Step 2: Convert hex strings back to Buffers */
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  /* Step 3: Create the decipher */
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  /* Step 4: Set the auth tag so GCM can verify integrity on final() */
  decipher.setAuthTag(authTag);

  /* Step 5: Decrypt and return the plaintext */
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
