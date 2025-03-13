/**
 * This is only the configuration for custom auth we've implemented beyond what Supabase offers.
 * You can change more things in your Supabase dashboard under authentication.
 */

import { TTwoFactorMethod, TVerificationMethod } from "@/types/auth";

export const AUTH_CONFIG = {
  socialProviders: {
    google: {
      enabled: true, // Enable if you set up Google Auth
    },
    github: {
      enabled: true, // Enable if you set up GitHub Auth
    },
  },
  // Available verification methods
  verificationMethods: {
    // Basic verification methods (for non-2FA accounts)
    email: {
      title: "Email",
      description: "Receive a verification code via email",
      type: "email" as TVerificationMethod,
      enabled: true,
    },
    password: {
      title: "Password",
      description: "Verify using your account password",
      type: "password" as TVerificationMethod,
      enabled: true,
    },
    // Two-factor methods (for 2FA-enabled accounts)
    twoFactor: {
      authenticator: {
        title: "Authenticator app",
        description: "Use your authenticator app to verify your identity",
        type: "authenticator" as TTwoFactorMethod,
        enabled: true,
      },
      sms: {
        title: "SMS",
        description: "Receive a verification code via SMS",
        type: "sms" as TTwoFactorMethod,
        enabled: false, // Disabled by default - enable if you've set up Twilio
      },
      backupCodes: {
        title: "Backup codes",
        description: "Use a backup code to verify your identity",
        type: "backup_codes" as TTwoFactorMethod,
        enabled: true,
      },
    },
  },

  backupCodes: {
    format: "words" as "words" | "alphanumeric" | "numeric",
    count: 10, // Number of backup codes to generate
    wordCount: 6, // Number of words per code (if using words format)
    alphanumericLength: 8, // Length of alphanumeric codes (if using alphanumeric format)
  },

  deviceSessions: {
    // Device sessions last for 1 year to match Supabase's refresh token expiration
    maxAge: 365,
  },

  // How long after a fresh verification can this device do sensitive actions?
  // After this time, need to verify again (2FA or basic depending on account security)
  // This is PER DEVICE SESSION to prevent attacks even if one device is compromised
  sensitiveActionGracePeriod: 5, // In minutes

  // Which operations need fresh verification
  // The verification method depends on account's security level:
  // - If account has 2FA: must use 2FA (or backup codes)
  // - If no 2FA: can use basic verification (email/password)
  requireFreshVerification: {
    revokeDevices: false,
    deleteAccount: true,
  },

  // Device verification (for unknown device login)
  deviceVerification: {
    codeExpirationTime: 10, // minutes
    codeLength: 6,
  },

  // Email alerts configuration
  emailAlerts: {
    login: {
      enabled: true, // Master switch to enable/disable all login email alerts
      alertMode: "unknown_only" as "all" | "unknown_only", // "all" = send for every login, "unknown_only" = only for new/unknown devices
      confidenceThreshold: 70, // Only send alerts for devices with confidence score below this threshold when in "unknown_only" mode
    },
    passwordChange: {
      enabled: true, // Send alerts when password is changed
    },
  },

  // Email verification configuration
  emailVerification: {
    codeExpirationTime: 10, // minutes
    codeLength: 6,
  },

  passwordReset: {
    // Whether users need to log in again after resetting their password
    // Disabled by default since user already proved ownership via email
    // To enable: generate RECOVERY_TOKEN_SECRET with `openssl rand -hex 32`
    // And add to `.env.local` like `RECOVERY_TOKEN_SECRET=generated-token`
    requireReloginAfterReset: false,
  },

  api_rate_limit: {
    enabled: true,
  },

  passwordRequirements: {
    // If you change the min length, make sure to change it in the Supabase dashboard as well.
    // https://supabase.com/dashboard/project/_/auth/providers (expand Email provider)

    // The other settings can be safely changed here. Please do not change "Password Requirements" in the Supabase dashboard.
    // Our code (API and client) will handle all of it securely.
    minLength: 8,
    maxLength: 72,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true,
  },
} as const;
