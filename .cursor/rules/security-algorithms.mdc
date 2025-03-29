---
description: 
globs: 
alwaysApply: true
---
# security-algorithms

### Device Trust Score Calculation
- MUST: Implement trust scoring using factors with exact weights: 
  - Device name match: 30 points
  - Browser match: 20 points  
  - OS match: 20 points
  - IP range match: 15 points
- AVOID: Using custom weights or additional factors
- WHY: Consistent evaluation of device trustworthiness across application
- EXAMPLE: `src/utils/auth/index.ts`
```ts
const calculateTrustScore = (device: DeviceInfo) => {
  let score = 0;
  if (device.name === storedDevice.name) score += 30;
  if (device.browser === storedDevice.browser) score += 20;
  //...etc
}
```

### Rate Limiting Tiers
- MUST: Implement the following rate limit tiers:
  - Auth operations: 10 requests/10 seconds
  - Authenticated operations: 100 requests/minute
  - General protection: 1000 requests/minute
  - SMS operations: IP + user-based limits
  - Data exports: 3 requests/day
- AVOID: Custom rate limit values or alternative implementations
- WHY: Protects against abuse while ensuring legitimate access
- EXAMPLE: `src/utils/rate-limit.ts`

### Verification Code Generation
- MUST: Generate verification codes using:
  - Authenticator: 6-digit numeric codes
  - SMS: 6-digit numeric codes 
  - Email: Custom length alphanumeric codes
  - Backup codes: Word-based or alphanumeric format
- AVOID: Custom code formats or lengths
- WHY: Ensures compatibility with standard authenticator apps and SMS
- EXAMPLE: `src/utils/auth/verification-codes.ts`

### Recovery Token Generation
- MUST: Generate recovery tokens using:
  - 32 bytes of random data
  - URL-safe base64 encoding
  - 1 hour expiration
- AVOID: Custom token formats or expiration times
- WHY: Industry standard approach for secure recovery links
- EXAMPLE: `src/utils/auth/recovery-token.ts`

### Data Export Security
- MUST: Implement the following controls:
  - One-time use download tokens
  - 24-hour token expiration
  - Automatic file cleanup after download
  - Rate limiting of 3 requests per day
- AVOID: Permanent download links or extended token validity
- WHY: Prevents unauthorized access to exported user data
- EXAMPLE: `src/utils/data-export/server.ts`

$END$