import { generateMnemonic, wordlists } from "bip39";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(
  (
    password: string | Buffer,
    salt: string | Buffer,
    keylen: number,
    callback: (err: Error | null, derivedKey: Buffer) => void
  ) => {
    scrypt(password, salt, keylen, callback);
  }
);

/**
 * Calculate entropy bits needed for desired number of words
 * BIP39 requires entropy to be between 128-256 bits (16-32 bytes)
 * Returns the number of bits needed (must be multiple of 32)
 */
function calculateEntropyBits(wordCount: number): number {
  // Each word needs 11 bits, but total entropy must be multiple of 32
  const minBits = Math.max(wordCount * 11, 128); // Ensure at least 128 bits
  // Round up to nearest multiple of 32
  const entropyBits = Math.ceil(minBits / 32) * 32;

  console.log("Entropy calculation:", {
    wordCount,
    minBits,
    entropyBits,
  });

  return entropyBits;
}

/**
 * Generates a numeric code with checksum
 * Format: XXXX-XXXX-XXXX-XXXX-CCC
 * where X are random digits and C is checksum
 */
function generateNumericCode(): string {
  // Generate 16 random digits (4 groups of 4)
  const groups: string[] = [];
  for (let i = 0; i < 4; i++) {
    const randomValue = randomBytes(2).readUInt16BE(0) % 10000;
    groups.push(randomValue.toString().padStart(4, "0"));
  }

  // Calculate checksum (sum of all digits mod 1000)
  const digits = groups.join("");
  const checksum =
    digits.split("").reduce((sum, digit) => sum + parseInt(digit, 10), 0) %
    1000;

  // Add checksum as final group
  groups.push(checksum.toString().padStart(3, "0"));

  return groups.join("-");
}

/**
 * Validates a numeric code's checksum
 */
function validateNumericChecksum(code: string): boolean {
  const parts = code.split("-");
  if (parts.length !== 5) return false;

  // Extract main digits and checksum
  const digits = parts.slice(0, 4).join("");
  const checksum = parseInt(parts[4], 10);

  // Calculate expected checksum
  const expectedChecksum =
    digits.split("").reduce((sum, digit) => sum + parseInt(digit, 10), 0) %
    1000;

  return checksum === expectedChecksum;
}

/**
 * Generates a verification code based on the specified format
 */
export async function generateVerificationCode(params: {
  format: "words" | "numeric" | "alphanumeric";
  wordCount?: number;
  alphanumericLength?: number;
}): Promise<{ code: string; hash: string; salt: string }> {
  let code: string;

  switch (params.format) {
    case "words": {
      if (!params.wordCount)
        throw new Error("wordCount is required for words format");

      console.log("Generating word-based code:", {
        requestedWordCount: params.wordCount,
      });

      const entropyBits = calculateEntropyBits(params.wordCount);

      console.log("About to generate mnemonic with entropy:", {
        entropyBits,
        type: typeof entropyBits,
      });

      try {
        const mnemonic = generateMnemonic(entropyBits);
        console.log("Generated mnemonic:", {
          fullMnemonic: mnemonic,
          wordCount: mnemonic.split(" ").length,
        });

        const words = mnemonic.split(" ").slice(0, params.wordCount);
        code = words.join("-");

        console.log("Final code:", {
          words,
          code,
          finalWordCount: words.length,
        });
      } catch (error) {
        console.error("Error generating mnemonic:", {
          error,
          entropyBits,
          wordCount: params.wordCount,
        });
        throw error;
      }
      break;
    }
    case "numeric": {
      code = generateNumericCode();
      break;
    }
    case "alphanumeric": {
      if (!params.alphanumericLength)
        throw new Error(
          "alphanumericLength is required for alphanumeric format"
        );

      // Generate more bytes than needed to ensure we have enough after filtering
      let result = "";
      while (result.length < params.alphanumericLength) {
        // Generate twice as many bytes as needed to ensure enough characters after filtering
        const bytes = randomBytes(params.alphanumericLength * 2);
        result += bytes.toString("base64").replace(/[^A-Z0-9]/g, "");
      }
      code = result.slice(0, params.alphanumericLength);
      break;
    }
    default:
      throw new Error(`Unsupported verification code format: ${params.format}`);
  }

  // Hash the generated code
  const { hash, salt } = await hashVerificationCode(code);

  return {
    code,
    hash,
    salt,
  };
}

/**
 * Hashes a verification code for secure storage
 */
export async function hashVerificationCode(
  code: string
): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(code, salt, 64);
  return {
    hash: hash.toString("hex"),
    salt,
  };
}

/**
 * Verifies a verification code against its hash
 */
export async function verifyVerificationCode(
  code: string,
  storedHash: string,
  salt: string
): Promise<boolean> {
  const hash = await scryptAsync(code, salt, 64);
  return hash.toString("hex") === storedHash;
}

/**
 * Validates a verification code format
 */
export function isValidVerificationCodeFormat(params: {
  code: string;
  format: "words" | "numeric" | "alphanumeric";
  wordCount?: number;
  alphanumericLength?: number;
}): boolean {
  const { code, format, wordCount, alphanumericLength } = params;

  switch (format) {
    case "words": {
      if (!wordCount) return false;
      const words = code.split("-");
      return (
        words.length === wordCount &&
        words.every((word) => wordlists.english.includes(word.toLowerCase()))
      );
    }
    case "numeric": {
      // Check format: XXXX-XXXX-XXXX-XXXX-CCC
      if (!/^\d{4}-\d{4}-\d{4}-\d{4}-\d{3}$/.test(code)) {
        return false;
      }
      // Validate checksum
      return validateNumericChecksum(code);
    }
    case "alphanumeric": {
      if (!alphanumericLength) return false;
      return code.length === alphanumericLength && /^[A-Z0-9]+$/.test(code);
    }
    default:
      return false;
  }
}

/**
 * Generates multiple verification codes at once
 * Returns both the plain codes and their hashed versions
 */
export async function generateVerificationCodes(params: {
  format: "words" | "numeric" | "alphanumeric";
  count: number;
  wordCount?: number;
  alphanumericLength?: number;
}): Promise<{
  codes: string[];
  hashedCodes: { hash: string; salt: string }[];
}> {
  const codes: string[] = [];
  const hashedCodes: { hash: string; salt: string }[] = [];

  for (let i = 0; i < params.count; i++) {
    const { code, hash, salt } = await generateVerificationCode({
      format: params.format,
      wordCount: params.wordCount,
      alphanumericLength: params.alphanumericLength,
    });

    codes.push(code);
    hashedCodes.push({ hash, salt });
  }

  return {
    codes,
    hashedCodes,
  };
}
