# Project Map

## Tech Stack
- Framework: Next.js 15
- Language: TypeScript
- Database: Supabase (PostgreSQL)
- State Management: Zustand
- UI Libraries:
  - Shadcn UI
  - Tailwind CSS
  - Framer Motion
  - Sonner (toasts)
  - Lucide React
  - React Icons (for app icons only)
- Form & Validation:
  - React Hook Form
  - Zod
  - React Phone Number Input (src/components/phone-input.tsx)
- Authentication & Security:
  - Supabase Auth
  - Upstash Redis (rate limiting)
- Email:
  - Resend
  - React Email
- Utilities:
  - date-fns
  - clsx & tailwind-merge
  - UA Parser JS
  - QR Code
  - Vercel Analytics

## Project Structure
- `src/` - Main source directory
  - `app/` - Next.js App Router pages and layouts
    - `account/` - Account management pages
    - `api/` - API routes
    - `auth/` - Authentication pages
    - `dashboard/` - User dashboard pages
  - `components/` - React components
    - `ui/` - Reusable UI components
    - Auth components:
      - `auth-form.tsx` - Main authentication form
      - `auth-confirm.tsx` - Email confirmation handling
      - `2fa-methods.tsx` - 2FA method management
      - `2fa-verify-form.tsx` - 2FA verification
    - User components:
      - `user-provider.tsx` - User context provider
      - `user-dropdown.tsx` - User menu dropdown
      - `device-sessions-list.tsx` - Device session management
  - `config/` - Configuration files
      - `config/auth.ts` - This is where we define our auth config
  - `hooks/` - Custom React hooks
  - `lib/` - Shared libraries and utilities
  - `store/` - Zustand state management
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `middleware.ts` - Next.js middleware for auth/routing

Important patterns:
- App Router based routing (Next.js 15)
- Component-first architecture
- Separation of UI components and business logic
- Type-safe development with TypeScript
- Centralized state management with Zustand
- API routes for server-side operations

## Core Features & Implementation

### Authentication System
- Sign-in Methods:
  - Email/Password Authentication
    - `src/app/api/auth/email/login/route.ts`
    - `src/app/api/auth/email/signup/route.ts`
  - Google OAuth
    - `src/app/api/auth/google/signin/route.ts`
    - `src/app/api/auth/callback/route.ts`
  - Password Reset & Recovery
    - `src/app/api/auth/forgot-password/route.ts`
    - `src/app/api/auth/reset-password/route.ts`

### Device Security
- Device Session Management:
  - Device Detection & Tracking
    - `src/utils/device-sessions/server.ts`
    - Uses UA Parser for device info
  - Confidence Scoring System
    - `src/utils/auth.ts`
    - Scores devices based on similarity to known devices
  - Session Management UI
    - `src/components/device-sessions-list.tsx`
    - View and manage active sessions

### Two-Factor Authentication (2FA)
- Multiple 2FA Methods:
  - Authenticator App
  - SMS (optional)
- Implementation:
  - `src/components/2fa-methods.tsx`
  - `src/components/2fa-verify-form.tsx`
  - Integration with device sessions for enhanced security

### Security Features
- API Rate Limiting
  - Uses Upstash Redis
  - Prevents brute force attacks
- Row Level Security (RLS)
  - Database-level security policies
  - Ensures users can only access their own data
- Email Notifications
  - New device logins
  - Security-sensitive actions
  - Uses Resend for delivery

### User Management
- Profile Management
  - `src/app/account/page.tsx`
  - Basic profile information
- Security Settings
  - `src/app/account/security/page.tsx`
  - 2FA configuration
  - Device session management
- Account Deletion
  - `src/components/delete-account.tsx`
  - Secure account removal process

## Important Utilities
Location: `src/utils/`

### Authentication Utilities (`auth.ts`, `auth/`)
- Device confidence scoring
- Two-factor authentication helpers
- Security level determination
- Local development utilities

### Rate Limiting (`rate-limit.ts`)
- API rate limiting with Upstash Redis
- IP address detection and validation
- Configurable limits per endpoint

### Validation (`validation/`)
- Zod schemas for form validation
- Password requirements validation
- Email format validation
- Two-factor code validation
- Phone number validation

### Device Sessions (`device-sessions/`)
- Device session management
- Trust level determination
- Session expiration handling

### Supabase (`supabase/`)
- Supabase client configuration
- Database connection utilities
- Authentication helpers

## Global State
Location: `src/store/`

### User Store (`user-store.ts`)
- User state management with Zustand
- Core functionality:
  - User authentication state
  - Loading and error states
  - User profile updates
  - Two-factor authentication management
  - Session management
- Key actions:
  - `setUser`: Update user state
  - `updateUser`: Modify user profile
  - `refreshUser`: Reload user data
  - `logout`: Handle user logout
  - `setup2FA`: Configure 2FA methods
  - `verify2FA`: Verify 2FA codes
  - `disable2FA`: Remove 2FA methods

## Types & Interfaces
Location: `src/types/`

### Authentication Types (`auth.ts`)
- User-related types:
  - `TUser`: Basic user information
  - `TUserWithAuth`: Extended user info with auth state
- Device-related types:
  - `TDeviceInfo`: Device identification info
  - `TDeviceSession`: Active session data
  - `TDeviceSessionOptions`: Session configuration
- Security types:
  - `TTwoFactorMethod`: 2FA method types
  - `TwoFactorRequirement`: 2FA configuration

### API Types (`api.ts`)
- Request types:
  - Device session management
  - User management
  - Two-factor authentication
  - Email and password operations
- Response types:
  - Success/error responses
  - Session data responses
  - Authentication responses
  - User data responses
- Shared interfaces:
  - Error handling
  - API responses
  - Data structures

## API Integration
Location: `src/app/api/`

### Authentication Endpoints (`/api/auth/`)
- Authentication flows:
  - Email: `/auth/email/` (login, signup)
  - Google OAuth: `/auth/google/`
  - Callbacks: `/auth/callback/` (OAuth handling)
  - Post-auth: `/auth/post-auth/` (post-login processing)
- Password management:
  - Reset: `/auth/reset-password/`
  - Change: `/auth/change-password/`
  - Forgot: `/auth/forgot-password/`
- Two-factor authentication:
  - Setup: `/auth/2fa/`
  - Verification: `/auth/verify/`
- Device management:
  - Sessions: `/auth/device-sessions/`
  - Verification: `/auth/verify-device/`
- Email operations:
  - Change: `/auth/change-email/`
  - Alerts: `/auth/send-email-alert/`
- Session management:
  - Logout: `/auth/logout/`
  - Confirm: `/auth/confirm/`

### User Management
- Read operations (`/api/user/`):
  - Get user profile data
  - Get authentication status
  - Get 2FA methods
- Update operations (`/api/auth/user/update/`):
  - Update profile data
  - Validation with Zod schemas
  - Prevents email updates (handled separately)
  - Automatic timestamp updates

### Common Patterns
- API Route Structure:
  - Route handlers in `route.ts`
  - Request/response typing
  - Error handling middleware
- Security:
  - Rate limiting on all endpoints
  - Authentication checks
  - Input validation
- Response Format:
  - Consistent error responses
  - Typed success responses
  - Status code standards

## Common Patterns & Conventions

### Naming Conventions
- Types:
  - Interfaces/Types prefixed with 'T' (e.g., `TUser`, `TDeviceInfo`)
  - API responses suffixed with 'Response' (e.g., `TApiErrorResponse`)
  - API requests suffixed with 'Request' (e.g., `TCreateUserRequest`)

### Error Handling
- Consistent error response format
- Type-safe error handling
- Error propagation through layers
- User-friendly error messages
- Rate limit error handling

### Form Handling
- Zod schema validation
- React Hook Form integration
- Type-safe form state
- Consistent error display
- Loading state management

### Data Fetching
- API route based data fetching
- Type-safe responses
- Loading states
- Error handling

### Security Practices
- Rate limiting on sensitive endpoints
- Input validation
- Authentication checks
- CSRF protection
- XSS prevention
- Secure cookie handling