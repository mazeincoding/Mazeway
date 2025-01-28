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
  },
  deviceSessions: {
    /**
     * Number of minutes within which a device session is considered "active".
     * If a device's last_active timestamp is within this threshold from now,
     * it will show as an active device with a green status indicator in the UI.
     */
    considerActiveWithinMinutes: 5,
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
