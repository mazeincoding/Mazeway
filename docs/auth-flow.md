# Authentication Flow

## 1. User Initiates Login
- Via Email/Password
- Via Google OAuth
- Both redirect to /api/auth/callback

## 2. Callback Route (/api/auth/callback)
1. Gets user info from Supabase
2. Creates/updates user in our DB
3. Detects device info:
   - Browser details
   - OS info
   - IP address

## 3. Device Session Creation
1. Create/find device record
2. Compare with user's existing devices
3. Calculate confidence score:
   - High (70+): Probably same device
   - Medium (40-69): Similar device
   - Low (<40): New/unknown device

## 4. Set Access Level
- Full: Known device, high confidence
- Verified: Similar device, medium confidence
- Restricted: New device, low confidence

## 5. User Notification
- Email alert for all new logins
- Redirect to app

## Security Notes
- All logins get notifications
- Google auth gets higher trust
- Device info stored for future comparison