---
description: 
globs: 
alwaysApply: true
---
# data-models

### Core Data Models

#### User Account Model
- MUST: Implement user accounts with:
  - Unique identifier (UUID)
  - Email address (verified status)
  - Password hash (bcrypt)
  - Account status (active/disabled)
  - Creation timestamp
  - Last login timestamp
- AVOID: Storing sensitive data in plain text
- WHY: Core identity model for authentication and access control
- EXAMPLE: `src/types/auth.ts`

#### Device Sessions
- MUST: Track device sessions with:
  - Session ID
  - User ID (foreign key)
  - Device info (browser, OS, IP)
  - Trust score (0-100)
  - Last active timestamp
  - Verification status
- AVOID: Storing raw IP addresses without hashing
- WHY: Required for security monitoring and session management
- EXAMPLE: `src/utils/auth/device-sessions/server.ts`

#### Account Events
- MUST: Log security events with:
  - Event ID
  - User ID
  - Event type (enum)
  - Metadata (JSON)
  - Device session ID (foreign key)
  - Timestamp
- AVOID: Including PII in metadata
- WHY: Audit trail for security and compliance
- EXAMPLE: `src/utils/account-events/server.ts`

### Authentication Methods

#### Two-Factor Authentication
- MUST: Store 2FA configuration:
  - Method type (authenticator/SMS)
  - Backup codes (hashed)
  - Phone number (E.164 format)
  - Verification status
  - Setup timestamp
- AVOID: Storing TOTP secrets in plain text
- WHY: Required for multi-factor security
- EXAMPLE: `src/types/auth.ts`

#### Social Providers
- MUST: Track OAuth connections:
  - Provider type (Google/GitHub)
  - Provider user ID
  - Access tokens (encrypted)
  - Connection status
  - Last sync timestamp
- AVOID: Storing refresh tokens in database
- WHY: Enables social login integration
- EXAMPLE: `src/utils/auth/index.ts`

### Data Export Models

#### Export Requests
- MUST: Track export jobs with:
  - Request ID
  - User ID
  - Status (pending/processing/complete)
  - File path
  - Created timestamp
  - Expiry timestamp
- AVOID: Storing exported data in database
- WHY: Manages user data export workflow
- EXAMPLE: `src/utils/data-export/server.ts`

### Relationships and Constraints
- MUST: Implement cascading deletes for:
  - User → Device Sessions
  - User → Account Events
  - User → 2FA Methods
  - User → Social Providers
- MUST: Enforce unique constraints on:
  - User email addresses
  - Device session IDs
  - Export request IDs
- WHY: Maintains data integrity and prevents orphaned records

$END$