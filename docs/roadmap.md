- [x] Implement device sessions and verification for untrusted devices
- [x] Create device verification email template
- [x] Preview the UI of all email templates and tweak if needed
- [x] Figure if Supabase has a "reset password" email template
    - If they do: we can use it
    - Otherwise, we'll need to create that too

> Update: Yes they do! They have `Reset password`

- [x] Create API endpoints for changing/forgot password:
    [x] `/api/auth/forgot-password`
    [x] `/api/auth/change-password`

> Why not just combine them? Because the code is so different, and they serve different purposes. One will need to receive the current password to change it. The other will receive an email to send a "forgot password" email.

- [x] Implement API rate limiting for endpoints
    - Does Vercel/Next.js have this out of the box? (no)
    - If not, how will we implement it? (Upstash Reddit)
- [x] Create forgot password page for non-authenticated users.
- [x] Modify the security settings page to use new API endpoint (`/api/auth/change-password`)
- [x] What if the user signed up with a different provider than email? They shouldn't be able to change password, we need to handle this in the app.
- [x] Allow authenticated users to reset their password even if they forgot it (with email and/or whatever 2FA is enabled. Need to figure this out)
- [ ] Implement 2FA:
    - [ ] Allow users to enable 2FA in the `settings/security` page
    - [ ] Show options: Authenticator App and SMS (based on the auth config)
    - [ ] Authenticator app:
        - [ ] Implement API endpoints:
            - [ ] `/api/auth/2fa/enroll` (starts enrollment, returns QR code URI)
            - [ ] `/api/auth/2fa/verify` (verifies the code, completes setup)
            - [ ] `/api/auth/2fa/disable` (requires current password and 2FA)
        - [ ] Show QR code when "Enable 2FA" is clicked
        - [ ] Require user to enter code
        - [ ] Generate recovery codes, show them and allow easy copying
        - [ ] In the `settings/security` page, now show "Regenerate recovery codes" (will this require 2FA?) and "Disable 2FA" (needs 2FA)
    - [ ] Require 2FA when:
        - [ ] Trying to login
        - [ ] Changing password
        - [ ] Revoking device session
        - [ ] Changing email
        - [ ] Turning off 2FA itself
- [ ] Revise flow
    - When 2FA is enabled:
        - [ ] Should a user need to verify a device after unknown login, even if 2FA is enabled and needs to be passed first?
        - [x] Will they need to verify through 2FA on ALL logins? (yes)
- [ ] Double check flow (just through the code) to ensure shit makes sense and it follows our initial plan.
- [ ] Figure out what the fuck we're gonna do with dev/production in Supabase. We'll (probably) need to update the README to clarify things or even more steps. (please never finish the other things so we never get to this painful thing)
- [ ] Set up landing and demo