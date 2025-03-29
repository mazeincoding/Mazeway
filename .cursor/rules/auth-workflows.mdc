---
description: 
globs: 
alwaysApply: true
---
# auth-workflows

### Two-Factor Authentication (2FA) Implementation
- MUST: Implement 2FA using authenticator apps and SMS with the following flow:
  1. Generate verification codes using `src/utils/auth/verification-codes.ts`
  2. Validate codes against hashes
- AVOID: 
  - Storing raw verification codes
  - Using email as primary 2FA method
  - Implementing custom code generation
- WHY: Ensures secure time-based verification while following industry standards
- EXAMPLE: `src/utils/auth/verification-codes.ts`

### Device Trust Calculation
- MUST: Calculate device trust scores using:
  - Device name match (30 points)
  - Browser match (20 points) 
  - OS match (20 points)
  - IP range match (15 points)
- AVOID:
  - Storing raw device identifiers
  - Using location as primary trust factor
  - Skipping verification for partially trusted devices
- WHY: Provides risk-based authentication while protecting user privacy
- EXAMPLE: `src/utils/auth/index.ts`

### Session Management
- MUST: Implement sessions with:
  1. Device fingerprinting via `src/utils/auth/device-sessions/server.ts`
  2. Session revocation requiring 2FA via `src/components/device-sessions-list.tsx`
  3. Location tracking for non-local IPs
- AVOID:
  - Storing sessions without device context
  - Auto-extending expired sessions
  - Using client-side session storage
- WHY: Enables secure multi-device access while maintaining user control
- EXAMPLE: `src/hooks/use-device-sessions.ts`

### Account Security Events
- MUST: Log security events with:
  - Device information
  - Event category (success/warning/error)
  - Verification method used
  - IP address and location
- AVOID:
  - Logging sensitive data
  - Missing critical security events
  - Delayed event logging
- WHY: Provides audit trail and security monitoring
- EXAMPLE: `src/utils/account-events/server.ts`

### Email Alert System
- MUST: Send alerts for:
  - New device logins
  - 2FA changes
  - Password changes
  - Email changes
  - Account deletion
- AVOID:
  - Sending alerts without device context
  - Using generic templates
  - Blocking main operations on alert failure
- WHY: Keeps users informed of security-relevant account changes
- EXAMPLE: `src/utils/email-alerts.ts`

### Rate Limiting
- MUST: Implement tiered rate limits:
  - Auth operations: 10/10s
  - SMS operations: User+IP based limits
  - Data exports: 3/day
- AVOID:
  - Global rate limits
  - Client-side rate limiting
  - Sharing limits across tenants
- WHY: Prevents abuse while allowing legitimate high-volume usage
- EXAMPLE: `src/utils/rate-limit.ts`

$END$