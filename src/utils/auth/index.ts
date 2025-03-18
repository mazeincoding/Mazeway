// This is a utility for generic auth related functions

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
  TDeviceTrust,
} from "@/types/auth";

/**
 * Auth-related utility functions
 */

/**
 * Calculates how much we trust a device login attempt
 * @param params All the info we need to make trust decisions
 */
export function calculateDeviceTrust({
  trustedSessions,
  currentDevice,
  isNewUser,
  isOAuthLogin,
  has2FA,
}: {
  trustedSessions: TDeviceSession[] | null;
  currentDevice: TDeviceInfo;
  isNewUser: boolean;
  isOAuthLogin: boolean;
  has2FA: boolean;
}): TDeviceTrust {
  // New users are fully trusted (it's their first device)
  if (isNewUser) {
    return {
      score: 100,
      level: "high",
      needsVerification: false,
      isTrusted: true,
    };
  }

  // OAuth logins get high base trust
  if (isOAuthLogin) {
    return {
      score: 85,
      level: "high",
      needsVerification: false,
      isTrusted: true,
    };
  }

  // Calculate score by comparing against stored sessions
  let score = 0;
  if (trustedSessions?.length) {
    const scores = trustedSessions.map((session) => {
      let matchScore = 0;
      const stored = session.device;

      // Device name match (30 points)
      if (stored.device_name === currentDevice.device_name) {
        matchScore += 30;
      }

      // Browser match (20 points)
      if (stored.browser === currentDevice.browser) {
        matchScore += 20;
      }

      // OS match - base name only (20 points)
      if (stored.os && currentDevice.os) {
        const storedBase = stored.os.split(" ")[0];
        const currentBase = currentDevice.os.split(" ")[0];
        if (storedBase === currentBase) {
          matchScore += 20;
        }
      }

      // IP range match (15 points)
      if (stored.ip_address && currentDevice.ip_address) {
        const storedIP = stored.ip_address.split(".").slice(0, 3).join(".");
        const currentIP = currentDevice.ip_address
          .split(".")
          .slice(0, 3)
          .join(".");
        if (storedIP === currentIP) {
          matchScore += 15;
        }
      }

      return matchScore;
    });

    score = Math.max(...scores);
  }

  // Determine trust level and verification needs
  const level = score >= 70 ? "high" : score >= 40 ? "medium" : "low";
  const needsVerification = !has2FA && score < 70; // Skip verification if 2FA enabled
  const isTrusted = score >= 70;

  return {
    score,
    level,
    needsVerification,
    isTrusted,
  };
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
export async function getUserVerificationMethods({
  supabase,
  supabaseAdmin,
}: {
  supabase: SupabaseClient;
  supabaseAdmin?: SupabaseClient;
}): Promise<{
  methods: TVerificationMethod[];
  factors: TVerificationFactor[];
  has2FA: boolean;
}> {
  if (typeof window !== "undefined") {
    // Code is running on the client
    try {
      // Get current user
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !authUser) {
        throw authError || new Error("No user found");
      }

      // Get user profile from database to check if they have a password and backup codes
      const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
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
        factorsData?.totp?.filter((factor) => factor.status === "verified") ||
        [];
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

      // On client, we rely on the has_backup_codes column in users table
      // Note: This is only for UI purposes as mentioned in the README
      if (userData.has_backup_codes) {
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
          if (authUser.email_confirmed_at) {
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
      console.error("Error getting user verification methods:", error);
      return {
        methods: [],
        factors: [],
        has2FA: false,
      };
    }
  } else {
    // Code is running on the server
    try {
      // Get current user
      const { user, error: userError } = await getUser({ supabase });
      if (userError || !user) {
        throw userError || new Error("No user found");
      }

      // Get user profile from database to check if they have a password
      const { data: profileData } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
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
        factorsData?.totp?.filter((factor) => factor.status === "verified") ||
        [];
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

      if (!supabaseAdmin) {
        throw new Error("Supabase admin client is required on the server");
      }

      // Check if user has backup codes
      const hasBackupCodes = await checkUserHasBackupCodes({
        supabaseAdmin,
        userId: userData.id,
      });
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
          if (user.auth.emailVerified) {
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
}

/**
 * Checks if a user has backup codes available
 * @param supabase Supabase client instance
 * @param userId The ID of the user to check backup codes for
 * @returns boolean indicating if the user has unused backup codes
 */
async function checkUserHasBackupCodes({
  supabaseAdmin,
  userId,
}: {
  supabaseAdmin: SupabaseClient;
  userId: string;
}): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { data, error } = await supabaseAdmin
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
export async function hasGracePeriodExpired({
  supabase,
  deviceSessionId,
}: {
  supabase: SupabaseClient;
  deviceSessionId: string;
}): Promise<boolean> {
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
export async function verifyTwoFactorCode({
  supabase,
  factorId,
  code,
}: {
  supabase: SupabaseClient;
  factorId: string;
  code: string;
}): Promise<void> {
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
export async function getFactorForMethod({
  supabase,
  method,
}: {
  supabase: SupabaseClient;
  method: TTwoFactorMethod;
}): Promise<{ success: boolean; factorId?: string; error?: string }> {
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
    "backup_codes", // Backup codes
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
    "backup_codes", // Backup codes
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
 * @param requireProfile Whether to require and fetch the user's profile data. Set to false ONLY in
 *                      special cases like post-auth where the profile doesn't exist yet.
 * @returns Object containing user data or error
 */
export async function getUser({
  supabase,
  requireProfile = true,
}: {
  supabase: SupabaseClient;
  requireProfile?: boolean;
}): Promise<{ user: TUserWithAuth | null; error: string | null }> {
  try {
    // Get auth user first since we need the ID
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      console.error("[getUser] Failed to get user", {
        error: userError,
        hasUser: !!authUser,
      });
      return { user: null, error: "Unauthorized" };
    }

    // If we don't need profile data (special cases), return minimal user object
    if (!requireProfile) {
      return {
        user: {
          id: authUser.id,
          email: authUser.email ?? "",
          name: "",
          avatar_url: "",
          has_password: false,
          has_backup_codes: false,
          created_at: authUser.created_at ?? new Date().toISOString(),
          updated_at: authUser.updated_at ?? new Date().toISOString(),
          auth: {
            emailVerified: !!authUser.email_confirmed_at,
            lastSignInAt: authUser.last_sign_in_at ?? new Date().toISOString(),
            twoFactorEnabled: false,
            enabled2faMethods: [],
            availableVerificationMethods: [],
            identities: authUser.identities?.map((identity) => ({
              id: identity.id,
              provider: identity.provider,
              identity_data: identity.identity_data ?? {},
              provider_id: identity.id,
              user_id: identity.user_id,
              created_at: identity.created_at ?? new Date().toISOString(),
              last_sign_in_at:
                identity.last_sign_in_at ?? new Date().toISOString(),
              updated_at: identity.updated_at ?? new Date().toISOString(),
            })),
          },
        },
        error: null,
      };
    }

    // Run remaining queries in parallel
    const [{ data: mfaData }, { data: userData, error: profileError }] =
      await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.from("users").select("*").eq("id", authUser.id).single(),
      ]);

    if (profileError) {
      return { user: null, error: "Failed to fetch user profile" };
    }

    // Process MFA data
    const enabled2faMethods =
      mfaData?.all
        ?.filter((factor) => factor.status === "verified")
        .map((factor) =>
          factor.factor_type === "totp" ? "authenticator" : "sms"
        ) || [];

    // Build verification methods
    const methods: string[] = [];
    if (enabled2faMethods.length > 0) {
      methods.push(...enabled2faMethods);
    } else {
      if (userData.has_password) methods.push("password");
      if (authUser.email_confirmed_at) methods.push("email");
    }

    const userWithAuth: TUserWithAuth = {
      ...userData,
      auth: {
        emailVerified: !!authUser.email_confirmed_at,
        lastSignInAt: authUser.last_sign_in_at,
        twoFactorEnabled: enabled2faMethods.length > 0,
        enabled2faMethods,
        availableVerificationMethods: methods,
        identities: authUser.identities,
      },
    };

    return { user: userWithAuth, error: null };
  } catch (error) {
    return { user: null, error: "Failed to get user data" };
  }
}

/**
 * Gets the current device session ID from cookies
 * Works in both client and server contexts
 * @param request Optional Request object (server-side only)
 * @returns The device session ID or null if not found
 */
export function getDeviceSessionId(request?: Request): string | null {
  // Server-side: Use Request object if available
  if (request) {
    return (
      request.headers
        .get("cookie")
        ?.split("; ")
        .find((cookie) => cookie.startsWith("device_session_id="))
        ?.split("=")[1] || null
    );
  }

  // Client-side: Use document.cookie
  if (typeof document !== "undefined") {
    return (
      document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("device_session_id="))
        ?.split("=")[1] || null
    );
  }

  return null;
}
