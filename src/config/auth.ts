import { TTwoFactorMethod } from "@/types/auth";

export const AUTH_CONFIG = {
  deviceVerification: {
    codeExpirationTime: 10,
    codeLength: 6,
  },
  deviceSessions: {
    maxAge: 365,
  },
  twoFactorAuth: {
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
    requireFor: {
      deviceLogout: true,
    },
  },
  passwordReset: {
    requireReloginAfterReset: false,
  },
  api_rate_limit: {
    enabled: true,
  },
  passwordRequirements: {
    minLength: 8,
    maxLength: 72,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: true,
  },
} as const;
