import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

if (!process.env.RECOVERY_TOKEN_SECRET) {
  throw new Error("RECOVERY_TOKEN_SECRET environment variable is required");
}

const SECRET = Buffer.from(process.env.RECOVERY_TOKEN_SECRET, "hex");

export function createRecoveryToken(userId: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, SECRET, iv);

  const encrypted = Buffer.concat([
    cipher.update(userId, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV, encrypted data, and auth tag
  const token = Buffer.concat([iv, encrypted, authTag]);
  return token.toString("base64");
}

export function verifyRecoveryToken(token: string): string | null {
  try {
    const tokenBuffer = Buffer.from(token, "base64");

    // Extract parts
    const iv = tokenBuffer.subarray(0, IV_LENGTH);
    const authTag = tokenBuffer.subarray(tokenBuffer.length - AUTH_TAG_LENGTH);
    const encrypted = tokenBuffer.subarray(
      IV_LENGTH,
      tokenBuffer.length - AUTH_TAG_LENGTH
    );

    // Decrypt
    const decipher = createDecipheriv(ALGORITHM, SECRET, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Failed to verify recovery token:", error);
    return null;
  }
}
