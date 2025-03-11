# Mazeway

## Introduction

The open-source auth foundation that lives in your project, not a node_modules folder.

**What's included**:

- Sign-in options:
  - `Email/password`
  - `Google`
  - `GitHub`
- Complete auth flow:
  - Login/signup pages
  - Password reset
  - Device sessions tracking
  - 2FA
    - Authenticator App
    - SMS
    - Backup codes
- Settings
  - Basic profile management
  - Change password
  - Device session management
    - View active sessions
    - Revoke device access
    - Email alerts for new logins
- Verification:
  - 2FA methods (Authenticator, SMS)
  - Backup codes (for 2FA-accounts)
    - Cryptographically secure
    - Supports multiple formats (words, alphanumeric, numeric)
  - Password verification (no-2FA accounts with password)
  - Email verification (no-2FA accounts)
- API rate limiting

## Tech stack

* Next.js 15
* Tailwind
* Shadcn
* Supabase
* Upstash Redis
* Resend

## Project structure (overview)
- docs/
- emails/ (react-email)
  - components/
  - templates/
- scripts/
- src/
  - app/
    - account/
      - page.tsx
      - layout.tsx
      - security/
        - page.tsx
    - api/
      - auth/
      - user/
    - auth/ (auth-related pages like login, forgot password, verify device, etc)
    - dashboard/
      - page.tsx
    - favicon.ico
    - global.css
    - layout.tsx
    - page.tsx
  - components/
    - ui/ (shadcn)
    - 2fa-methods.tsx
    - 2fa-setup-dialog.tsx
    - auth-confirm.tsx
    - auth-form.tsx
    - back-button.tsx
    - delete-account.tsx
    - device-sessions-list.tsx
    - header.tsx
    - setting-card.tsx
    - user-dropdown.tsx
    - user-provider.tsx
    - verify-form.tsx
  - config/
    - auth.ts
  - hooks/
    - use-auth.ts
    - use-device-sessions.ts
    - use-mobile.ts
    - use-toast.ts
  - lib/
    - utils.ts
  - types/
    - api.ts
    - auth.ts
  - utils/
    - auth/recovery-token.ts
    - device-sessions/server.ts
    - supabase/
      - client.ts
      - middleware.ts
      - server.ts
    - validation/
      - auth-validation.tsx
    - api.ts (centralized utility for API calls, used by components)
    - auth.ts (auth utilities)
    - rate-limit.ts
    - verification-codes.ts
  - middleware.ts

## Email templates

Email templates in the Supabase dashboard:
- Confirm sign up
- Invite user
- Magic Link
- Change Email Address
- Reset Password
- Reauthentication

Custom email templates (that Supabase doesn't offer) live in this project in `/emails`:
- Verify device (`/emails/templates/device-verification.tsx`)
- Login alert (`/emails/templates/email-alert.tsx`)
- Verify email (`/emails/templates/email-verification.tsx`)
- Header component (`/emails/components/header.tsx`)

## Auth configuration

The project has an auth config at `/src/config/auth.ts`

### Overview

- **Social Providers**
  - Google
  - GitHub
- **Verification Methods**
  - Email
  - Password
  - Two-Factor
    - Authenticator
    - SMS
    - Backup Codes
- **Backup Codes**
  - Format
  - Count
  - Word count
  - Alphanumeric length
- **Device Sessions**
  - Max age
- **Security**
  - Sensitive action grace period
  - Require Fresh Verification
    - Revoke devices
    - Delete account
- **Device Verification**
  - Code expiration time
  - Code length
- **Email Alerts**
  - Enabled
  - Alert mode
  - Confidence threshold
- **Email Verification**
  - Code expiration time
  - Code length
- **Password Reset**
  - Require relogin after reset
- **API Rate Limiting**
  - Enabled
- **Password Requirements**
  - Minimum length
  - Maximum length
  - Require lowercase
  - Require uppercase
  - Require numbers
  - Require symbols

View the full file at `/src/config/auth.ts`

## Types

Types and interfaces are defined at `src/types`. You'll find:
- `api.ts` (API request/response types)
- `auth.ts` (auth-related types, user, 2FA, etc)

We prefix types/interfaces with a `T` to avoid conflicting types with React components.