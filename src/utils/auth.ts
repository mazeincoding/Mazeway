import { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_CONFIG } from "@/config/auth";
import {
  TDeviceInfo,
  TDeviceSession,
  TTwoFactorMethod,
  TwoFactorRequirement,
} from "@/types/auth";

/**
 * Auth-related utility functions
 */

/**
 * Calculates confidence score for a device login by comparing with stored sessions
 * @param storedSessions Array of user's previous device sessions
 * @param current Current device information
 * @returns number Confidence score from 0-100
 */
export function calculateDeviceConfidence(
  storedSessions: TDeviceSession[] | null,
  current: TDeviceInfo
): number {
  // First device login gets high confidence
  if (!storedSessions?.length) {
    return 100;
  }

  // Calculate confidence against each stored device and return highest score
  const scores = storedSessions.map((session) => {
    let score = 0;
    const stored = session.device;

    // Device name match (30 points)
    if (stored.device_name === current.device_name) {
      score += 30;
    }

    // Browser match (20 points)
    if (stored.browser === current.browser) {
      score += 20;
    }

    // OS match - base name only (20 points)
    if (stored.os && current.os) {
      const storedBase = stored.os.split(" ")[0];
      const currentBase = current.os.split(" ")[0];
      if (storedBase === currentBase) {
        score += 20;
      }
    }

    // IP range match (15 points)
    if (stored.ip_address && current.ip_address) {
      const storedIP = stored.ip_address.split(".").slice(0, 3).join(".");
      const currentIP = current.ip_address.split(".").slice(0, 3).join(".");
      if (storedIP === currentIP) {
        score += 15;
      }
    }

    return score;
  });

  // Return the highest confidence score found
  return Math.max(...scores);
}

/**
 * Gets the confidence level based on a numeric score
 * @param score Numeric confidence score
 * @returns "high" | "medium" | "low" confidence level
 */
export function getConfidenceLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Checks if 2FA is required for a user and returns available methods
 * @param supabase Supabase client instance
 * @returns Object containing 2FA requirements and available methods
 */
export async function checkTwoFactorRequirements(
  supabase: SupabaseClient
): Promise<TwoFactorRequirement> {
  // If 2FA is not enabled in config, skip check
  if (!AUTH_CONFIG.twoFactorAuth.enabled) {
    return { requiresTwoFactor: false };
  }

  // Get all enabled 2FA methods from config
  const enabledMethods = AUTH_CONFIG.twoFactorAuth.methods.filter(
    (m) => m.enabled
  );

  if (enabledMethods.length === 0) {
    return { requiresTwoFactor: false };
  }

  // Get user's enrolled factors
  const { data, error: factorsError } = await supabase.auth.mfa.listFactors();

  if (factorsError) {
    console.error("Error getting MFA factors:", factorsError);
    throw new Error("Failed to check 2FA status");
  }

  const availableMethods: Array<{
    type: TTwoFactorMethod;
    factorId: string;
  }> = [];

  // Check for verified TOTP factors
  if (data?.totp) {
    const verifiedTOTP = data.totp.filter(
      (factor) => factor.status === "verified"
    );

    if (verifiedTOTP.length > 0) {
      availableMethods.push({
        type: "authenticator",
        factorId: verifiedTOTP[0].id,
      });
    }
  }

  // Check for verified SMS factors
  if (data?.phone) {
    const verifiedSMS = data.phone.filter(
      (factor) => factor.status === "verified"
    );

    if (verifiedSMS.length > 0) {
      availableMethods.push({
        type: "sms",
        factorId: verifiedSMS[0].id,
      });
    }
  }

  // If user has any verified factors, require 2FA
  if (availableMethods.length > 0) {
    // Default to authenticator if available, otherwise first available method
    const defaultMethod =
      availableMethods.find((m) => m.type === "authenticator") ||
      availableMethods[0];

    return {
      requiresTwoFactor: true,
      factorId: defaultMethod.factorId,
      availableMethods,
    };
  }

  return { requiresTwoFactor: false };
}

/**
 * Verifies a 2FA code
 * @param supabase Supabase client instance
 * @param factorId The ID of the factor to verify
 * @param code The verification code
 */
export async function verifyTwoFactorCode(
  supabase: SupabaseClient,
  factorId: string,
  code: string
): Promise<void> {
  // Create challenge
  const { data: challengeData, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) {
    throw new Error(challengeError.message);
  }

  // Verify the code
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code,
  });

  if (verifyError) {
    throw new Error(verifyError.message);
  }
}
