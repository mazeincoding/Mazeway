/**
 * This is only the configuration for custom auth we've implemented beyond what Supabase offers.
 * You can change more things in your Supabase dashboard under authentication.
 */

export const AUTH_CONFIG = {
  deviceVerification: {
    codeExpirationTime: 10,
    codeLength: 6,
  },
} as const;
