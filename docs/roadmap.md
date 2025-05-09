## Mazeway roadmap

- [x] Implement device sessions and verification for untrusted devices
- [x] Create device verification email template
- [x] Preview the UI of all email templates and tweak if needed
- [x] Figure if Supabase has a "reset password" email template
    - If they do: we can use it
    - Otherwise, we'll need to create that too

> Update: Yes they do! They have `Reset password`

- [x] Create API endpoints for changing/forgot password:
    - [x] `/api/auth/forgot-password`
    - [x] `/api/auth/change-password`

> Why not just combine them? Because the code is so different, and they serve different purposes. One will need to receive the current password to change it. The other will receive an email to send a "forgot password" email.

- [x] Implement API rate limiting for endpoints
    - Does Vercel/Next.js have this out of the box? (no)
    - If not, how will we implement it? (Upstash Reddit)
- [x] Create forgot password page for non-authenticated users.
- [x] Modify the security settings page to use new API endpoint (`/api/auth/change-password`)
- [x] What if the user signed up with a different provider than email? They shouldn't be able to change password, we need to handle this in the app.
- [x] Allow authenticated users to reset their password even if they forgot it (with email and/or whatever 2FA is enabled. Need to figure this out)
- [x] Implement 2FA:
    - [x] Allow users to enable 2FA in the `settings/security` page
    - [x] Show options: Authenticator App and SMS (based on the auth config)
    - [x] Authenticator app:
        - [x] Implement API endpoints:
            - [x] `/api/auth/2fa/enroll` (starts enrollment, returns QR code URI)
            - [x] `/api/auth/2fa/verify` (verifies the code, completes setup)
            - [x] `/api/auth/2fa/disable` (requires current password and 2FA)
        - [x] Show QR code when "Enable 2FA" is clicked
        - [x] Require user to enter code
        - [x] Generate recovery codes, show them and allow easy copying
        - [x] In the `settings/security` page, now show "Regenerate recovery codes" (will this require 2FA?) and "Disable 2FA" (needs 2FA)
    - [x] SMS
        - [x] Figure out if we need to set up any additional services or if Supabase is all we need (need Twilio)
        - [x] If setting up other services: add instructions to README
        - [x] Also explain how you can enable/disable 2FA and methods in the config
        - [x] Modify 2FA endpoints (enroll, verify, disable) to handle SMS with "method" in the body
        - [x] Add enterprise-level security with extra rate limits
        - [x] Ensure no IP Spoofing
        - [x] Add SMS for 2FA setup dialog
        - [x] Update security page to work with SMS
    - [x] Require 2FA when:
        - [x] Trying to login
        - [x] Changing password
        - [x] Revoking device session
        - [x] Changing email
        - [x] Turning off 2FA itself
    - [x] Ensure when 2FA verification is needed in the flow, we handle authenticator and SMS
- [x] Implement change email feature
    - [x] Make user verify new email
- [x] Refactor project to:
    - Use Zustand as a store for UI, not logic.
    - Be consistent with using API routes for actual logic.
- [x] Revise flow
    - When 2FA is enabled:
        - [x] Should a user need to verify a device after unknown login, even if 2FA is enabled and needs to be passed first? ~~(yes)~~ (NO)
            ~~- They're two different things~~
            ~~- And serve different purposes~~
            ~~- Device verification isn't just security~~
            ~~- It's about keeping a list of trusted devices~~
            ~~- A history of logged in devices~~
            ~~- And build trust with future devices~~
            
            Update Feb 2025: This was overcomplicated BS. Making users verify device ownership AFTER they've already proven ownership through 2FA is redundant and bad UX. We can still track devices and sessions, we just trust them after 2FA (which makes sense since it's a stronger verification). Both methods prove "something you have", 2FA is just stronger. All the benefits of device tracking (session history, device trust, activity monitoring) still work the same way - we're just skipping the weaker verification when we already have a stronger one.

            The previous points assumed we wouldn't even create the device session, which isn't true at all. We should create the device session, but mark it as trusted. Simple as that. If you still don't understand, let me break down why each point is stupid.

        - [x] Will they need to verify through 2FA on ALL logins? (yes)
- [x] Double check flow (just through the code) to ensure shit makes sense and it follows our initial plan.
- [x] Figure out what the fuck we're gonna do with dev/production in Supabase. We'll (probably) need to update the README to clarify things or even more steps. (please never finish the other things so we never get to this painful thing. UPDATE: I somehow did it)
- [x] Set up landing and demo (though irrelevant for this auth starter)
- [ ] ~~Add a docs page for our site~~ (forget about this, READMEs are cooler)
- [x] Recovery codes generation
- [x] Password complexity requirements
- [ ] Password breach checking (Supabase already has this but we could add it to our API routes? Not crucial)
- [ ] CAPTCHA for login
- [ ] Support passwordless auth
- [x] Additional providers (can't really check because you can always add more but good for now)
- [x] Account security events
- [x] Email alerts for security actions
- [x] Account deletion functionality
- [ ] Re-design settings UI to focus on simplicity
- [x] Maybe clean up all my GitHub issues I created and left there
- [x] User data exports (GDPR Compliance)
- [x] Provider management
- [ ] Role-based access control

**CLI direction**
- [ ] Create a CLI for adding auth to existing projects
- [ ] Add extensions market for CLI to add features on top by the community