/**
 * This is only the configuration for custom auth we've implemented beyond what Supabase offers.
 * You can change more things in your Supabase dashboard under authentication.
 */

import { TTwoFactorMethod } from "@/types/auth";

export const AUTH_CONFIG = {
  deviceVerification: {
    codeExpirationTime: 10,
    codeLength: 6,
  },
  deviceSessions: {
    // Device sessions last for 1 year to match Supabase's refresh token expiration.
    maxAge: 365,
  },
  twoFactorAuth: {
    // Important: enabling/disabling two factor authentication or any methods does NOT control the user preferences
    // This is a feature flag that controls which methods are available in the app
    methods: [
      {
        title: "Authenticator app",
        description: "Use your authenticator app to verify your identity",
        enabled: true,
        type: "authenticator" as TTwoFactorMethod,
      },
      {
        title: "SMS",
        description: "Receive a verification code via SMS",
        enabled: false,
        type: "sms" as TTwoFactorMethod,
      },
    ],
    enabled: true,
    // Controls which operations require a fresh 2FA verification
    // even if the user's session already has AAL2
    requireFreshVerificationFor: {
      // Whether a fresh 2FA verification is required to log out other devices
      // If enabled, a grace period (in minutes) can be set
      // which means subsequent device logouts won't require re-verification
      deviceLogout: {
        enabled: true,
        gracePeriodMinutes: 5,
      },
    },
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
    // https://supabase.com/dashboard/project/_/settings/auth

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
