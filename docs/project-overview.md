# Mazeway

> This document serves as a memory/overview of the codebase for LLMs. It helps them understand the project structure, key features, and important implementation details. The document is maintained automatically and should be updated whenever significant changes are made to the codebase.

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
- Account activity tracking
  - View activity history (logins, disable 2FA, etc)
  - Get alerts for sensitive activity (unknown device login, etc)
- Settings
  - Basic profile management
  - Change password
  - Device session management
    - View active sessions
    - Revoke device access
    - Email alerts for new logins
  - Data export
    - Request account data export
    - Secure download with one-time tokens
    - Rate-limited requests
    - Automatic file cleanup
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

## Key Utilities & Types

### Auth (`src/utils/auth.ts`)
- `getDeviceSessionId(request?)`: Get current device session ID from cookies
- `calculateDeviceConfidence(...)`: Calculate trust score for a device
- `getConfidenceLevel(score)`: Convert trust score to "high" | "medium" | "low"
- `getConfigured2FAMethods()`: Get available 2FA methods from config
- `getDefaultVerificationMethod(...)`: Get default verification method for user
- `getDefault2FAMethod(...)`: Get default 2FA method for user
- `isLocalIP(ip)`: Check if IP is local/development

### Rate Limiting (`src/utils/rate-limit.ts`)
- `getClientIp(request)`: Extract client IP from request
- Rate limit instances:
  - `authRateLimit`: Auth endpoints (login, signup)
  - `apiRateLimit`: General API endpoints
  - `basicRateLimit`: Basic operations
  - `smsRateLimit`: SMS-specific operations

### Device Info
- Uses `ua-parser-js` for consistent device info extraction:
  - Device name/model
  - Browser info
  - OS details

### Validation (`src/utils/validation/auth-validation.ts`)
- Zod schemas for all auth operations
- Key validation functions:
  - `validatePassword(password)`
  - `validateEmail(email)`
  - `validatePhoneNumber(phone)`
  - `validateTwoFactorCode(code)`
  - `getPasswordRequirements(password)`

### Types (`src/types/`)
- `auth.ts`:
  - `TUser`: Base user type
  - `TUserWithAuth`: User with auth details
  - `TDeviceSession`: Device session info
  - `TAAL`: Auth assurance levels
  - `TVerificationMethod`: All verification methods
  - `TTwoFactorMethod`: 2FA methods subset
- `api.ts`:
  - Request/response types for all API endpoints
  - All verification requirements interfaces

### Supabase (`src/utils/supabase/`)
- `server.ts`: Server-side Supabase client
  - `createClient({ useServiceRole?: boolean })`: Create Supabase client
    - Service role bypasses RLS and has full admin access
    - Use ONLY for operations that need to:
      - Create/modify data for other users
      - Bypass RLS policies
      - Access tables without policies
      - Perform admin operations
    - Examples where it's needed:
      - Creating device sessions for users
      - Managing user profiles
      - Logging events for audit trails
      - Handling backup codes
    - NEVER use in client-side code or expose the key
- `client.ts`: Browser-side Supabase client
  - `createClient()`: Create browser-safe client
  - Uses public anon key only
  - Limited to operations allowed by RLS
- `middleware.ts`: Auth middleware and session handling

### Recovery (`src/utils/auth/recovery-token.ts`)
- `createRecoveryToken(userId)`: Create recovery token
- `verifyRecoveryToken(token)`: Verify and extract userId

### Data Export (`src/utils/data-export/`)
- Shared utilities (`src/utils/data-export/index.ts`):
  - `getDataExportStoragePath(...)`: Get storage path for export files
- Server-side utilities (`src/utils/data-export/server.ts`):
  - Protected with `assertServer()` checks
  - Functions:
    - `createDataExportRequest(...)`: Create new export request
    - `getDataExportStatus(...)`: Check export status
    - `verifyDataExportToken(...)`: Verify download token
    - `updateDataExportStatus(...)`: Update export status
    - `cleanupDataExportFile(...)`: Clean up export file
- API Routes:
  - `POST /api/auth/data-exports`: Create export request
  - `GET /api/auth/data-exports/[id]`: Check export status
  - `GET /api/auth/data-exports/[id]/download`: Download export file
- Security features:
  - One-time use download tokens
  - Token hashing with salt
  - Rate limiting (3 requests per day)
  - Auto file cleanup after download
  - Service role for storage operations

## Project structure
- `app/`: Next.js app router structure
  - `account/`: User settings & security
  - `api/`: Backend endpoints
  - `auth/`: Auth-related pages
  - `dashboard/`: Main app pages
- `components/`: React components
  - `ui/`: shadcn components
  - Auth-specific components (2FA, verification, etc)
- `emails/`: Email templates (react-email)
- `utils/`: Core utilities
  - `auth/`: Auth utilities
  - `device-sessions/`: Device tracking
  - `supabase/`: Database clients
  - `validation/`: Zod schemas & validators

## Path Aliases
The project uses the following path aliases:
- `@/` - Root directory (e.g. `@/utils/auth`)
- `@emails` - Email templates directory (e.g. `@emails/templates/email-alert`)

## Configuration

Auth config lives in `src/config/auth.ts` - controls:
- Social providers
- Verification methods
- Backup codes settings
- Device session settings
- Security settings
- Rate limiting
- Password requirements

## Database Schema
See `docs/supabase-snippets.md` for database schema details
- Rate limiting
- Password requirements

## Database Schema
See `docs/supabase-snippets.md` for database schema details