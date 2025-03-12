import { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_CONFIG } from "@/config/auth";
import {
  TDeviceInfo,
  TDeviceSession,
  TTwoFactorMethod,
  TVerificationMethod,
  TUser,
  TVerificationFactor,
  TUserWithAuth,
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
  // If no stored sessions, calculate a baseline score
  // Trust for first-time signups is handled explicitly in setupDeviceSession
  if (!storedSessions?.length) {
    // No device sessions to compare to
    return 0;
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
 * Gets all 2FA methods that are enabled in the app configuration
 * @returns Array of enabled 2FA method configurations from auth config
 */
export function getConfigured2FAMethods() {
  return Object.values(AUTH_CONFIG.verificationMethods.twoFactor).filter(
    (method) => method.enabled
  );
}

/**
 * Gets all verification methods available to the user
 * This includes both 2FA methods (authenticator, SMS, backup codes) and basic methods (email, password)
 *
 * @param supabase - Supabase client instance
 * @returns Object containing all verification data:
 *   - methods: Array of available verification method types
 *   - factors: Array of verification factors with their IDs (for 2FA methods)
 *   - has2FA: Whether the user has any 2FA methods enabled
 */
export async function getUserVerificationMethods(
  supabase: SupabaseClient
): Promise<{
  methods: TVerificationMethod[];
  factors: TVerificationFactor[];
  has2FA: boolean;
}> {
  try {
    // Get current user
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw error || new Error("No user found");
    }

    // Get user profile from database to check if they have a password
    const { data: profileData } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    const userData = profileData as TUser;

    // Get all MFA factors from Supabase
    const { data: factorsData, error: factorsError } =
      await supabase.auth.mfa.listFactors();
    if (factorsError) {
      throw factorsError;
    }

    const methods: TVerificationMethod[] = [];
    const factors: TVerificationFactor[] = [];

    // Check for verified TOTP (authenticator) factors
    const verifiedTOTP =
      factorsData?.totp?.filter((factor) => factor.status === "verified") || [];
    if (verifiedTOTP.length > 0) {
      methods.push("authenticator");
      factors.push({
        type: "authenticator",
        factorId: verifiedTOTP[0].id,
      });
    }

    // Check for verified SMS factors
    const verifiedSMS =
      factorsData?.phone?.filter((factor) => factor.status === "verified") ||
      [];
    if (verifiedSMS.length > 0) {
      methods.push("sms");
      factors.push({
        type: "sms",
        factorId: verifiedSMS[0].id,
      });
    }

    // Check if user has backup codes
    const hasBackupCodes = await checkUserHasBackupCodes(supabase, userData.id);
    if (hasBackupCodes) {
      methods.push("backup_codes");
      factors.push({
        type: "backup_codes",
        factorId: "backup", // Special identifier for backup codes
      });
    }

    // Determine if user has any 2FA methods enabled
    const has2FA = verifiedTOTP.length > 0 || verifiedSMS.length > 0;

    // If no 2FA, add basic verification methods
    if (!has2FA) {
      // Add password verification if user has a password
      if (userData.has_password) {
        methods.push("password");
      }

      // Add email verification if enabled in config and user has verified email
      if (userData.email && AUTH_CONFIG.verificationMethods.email.enabled) {
        if (data.user.email_confirmed_at) {
          methods.push("email");
        }
      }
    }

    return {
      methods,
      factors,
      has2FA,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Checks if a user has backup codes available
 * @param supabase Supabase client instance
 * @param userId The ID of the user to check backup codes for
 * @returns boolean indicating if the user has unused backup codes
 */
async function checkUserHasBackupCodes(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { data, error } = await supabase
    .from("backup_codes")
    .select("id")
    .eq("user_id", userId)
    .is("used_at", null)
    .limit(1);

  if (error) {
    return false;
  }

  return data.length > 0;
}

/**
 * Checks if the grace period since last verification has expired
 * Users need to verify again if:
 * 1. They've never verified (no timestamp)
 * 2. Their last verification is older than the grace period
 */
export async function hasGracePeriodExpired(
  supabase: SupabaseClient,
  deviceSessionId: string
): Promise<boolean> {
  const { data: session } = await supabase
    .from("device_sessions")
    .select("last_sensitive_verification_at")
    .eq("id", deviceSessionId)
    .single();

  if (!session?.last_sensitive_verification_at) {
    return true;
  }

  const gracePeriod = new Date();
  gracePeriod.setMinutes(
    gracePeriod.getMinutes() - AUTH_CONFIG.sensitiveActionGracePeriod
  );

  return new Date(session.last_sensitive_verification_at) < gracePeriod;
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

/**
 * Gets the factor ID for a specific 2FA method with error handling
 * @param method The 2FA method to get the factor ID for
 * @returns Object containing success status and factor ID or error message
 */
export async function getFactorForMethod(
  supabase: SupabaseClient,
  method: TTwoFactorMethod
): Promise<{ success: boolean; factorId?: string; error?: string }> {
  try {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.all?.find(
      (f) =>
        f.status === "verified" &&
        (f.factor_type === "totp"
          ? method === "authenticator"
          : method === "sms")
    );

    if (!factor?.id) {
      return { success: false, error: "2FA method not found" };
    }

    return { success: true, factorId: factor.id };
  } catch (err) {
    return {
      success: false,
      error: "Failed to get 2FA method",
    };
  }
}

/**
 * Checks if an IP address is a local/development IP
 * @param ip IP address to check
 * @returns boolean indicating if the IP is local
 */
export function isLocalIP(ip: string): boolean {
  const LOCAL_IPS = new Set(["127.0.0.1", "::1", "localhost"]);
  return LOCAL_IPS.has(ip);
}

/**
 * Gets the most secure enabled verification method for the user
 * Security precedence:
 * 1. 2FA Methods (if enabled)
 *    - Authenticator (most secure)
 *    - SMS
 *    - Backup codes (not implemented yet)
 * 2. Basic Methods (if no 2FA)
 *    - Password
 *    - Email (least secure)
 */
export function getDefaultVerificationMethod(
  enabledMethods: TVerificationMethod[]
): TVerificationMethod | null {
  if (!enabledMethods.length) {
    return null;
  }

  // Security preference order - 2FA methods first, then basic methods
  const securityPreference: TVerificationMethod[] = [
    "authenticator", // Most secure 2FA
    "sms", // Less secure 2FA
    // "backup_codes", // TODO: Will be implemented later
    "password", // Most secure basic
    "email", // Least secure basic
  ];

  // Find the most secure method that is enabled
  return (
    securityPreference.find((method) => enabledMethods.includes(method)) ?? null
  );
}

/**
 * Gets the most secure enabled 2FA method
 * Only considers actual 2FA methods (authenticator, SMS, backup codes pending)
 * Used when account has 2FA enabled and we need to enforce 2FA verification
 */
export function getDefault2FAMethod(
  enabledMethods: TTwoFactorMethod[]
): TTwoFactorMethod | null {
  if (!enabledMethods.length) {
    return null;
  }

  // Security preference order for 2FA methods only
  const securityPreference: TTwoFactorMethod[] = [
    "authenticator", // Most secure
    "sms", // Less secure
    // "backup_codes", // TODO: Will be implemented later
  ];

  // Find the most secure method that is enabled
  return (
    securityPreference.find((method) => enabledMethods.includes(method)) ?? null
  );
}

/**
 * Gets the actual Authentication Assurance Level (AAL) from our device sessions table
 * This is more reliable than Supabase's getAuthenticatorAssuranceLevel() as it includes
 * our custom backup codes implementation
 *
 * @param supabase Supabase client instance
 * @param deviceSessionId The ID of the device session to check
 * @returns Promise<"aal1" | "aal2"> The current AAL level
 */
export async function getAuthenticatorAssuranceLevel(
  supabase: SupabaseClient,
  deviceSessionId: string
): Promise<"aal1" | "aal2"> {
  if (!deviceSessionId) {
    return "aal1";
  }

  // First check if session exists without expiry check
  await supabase
    .from("device_sessions")
    .select("id, aal, expires_at")
    .eq("id", deviceSessionId)
    .single();

  // Then do the actual query with expiry check
  const { data: session } = await supabase
    .from("device_sessions")
    .select("aal")
    .eq("id", deviceSessionId)
    .gt("expires_at", new Date().toISOString())
    .single();

  return session?.aal || "aal1";
}

/**
 * Gets complete user data combining Supabase auth with profile data
 * Use this in server contexts (API routes, server components, utilities)
 *
 * @param supabase Supabase client instance
 * @returns Object containing user data or error
 */
export async function getUser(supabase: SupabaseClient) {
  try {
    // Get authenticated user
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !authUser) {
      return { user: null, error: "Unauthorized" };
    }

    // Get user profile from database
    const { data: userData, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError) {
      console.error("Failed to fetch user profile:", profileError);
      return { user: null, error: "Failed to fetch user profile" };
    }

    // Get MFA factors
    const { data: mfaData } = await supabase.auth.mfa.listFactors();

    // Get enabled 2FA methods
    const enabled2faMethods =
      mfaData?.all
        ?.filter((factor) => factor.status === "verified")
        .map((factor) =>
          factor.factor_type === "totp" ? "authenticator" : "sms"
        ) || [];

    // Get available verification methods
    const { methods: availableVerificationMethods } =
      await getUserVerificationMethods(supabase);

    // Combine user data
    const userWithAuth: TUserWithAuth = {
      ...userData,
      auth: {
        emailVerified: !!authUser.email_confirmed_at,
        lastSignInAt: authUser.last_sign_in_at,
        twoFactorEnabled: enabled2faMethods.length > 0,
        enabled2faMethods,
        availableVerificationMethods,
        identities: authUser.identities,
      },
    };

    return { user: userWithAuth };
  } catch (error) {
    console.error("Error in getUser:", error);
    return { user: null, error: "Failed to get user data" };
  }
}
