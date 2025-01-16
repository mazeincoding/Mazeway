- [x] Implement device sessions and verification for untrusted devices
- [x] Create device verification email template
- [x] Preview the UI of all email templates and tweak if needed
- [x] Figure if Supabase has a "reset password" email template
    - If they do: we can use it
    - Otherwise, we'll need to create that too

> Update: Yes they do! They have `Reset password`

- [ ] Create API endpoints for changing/forgot password:
    - `/api/auth/forgot-password`
    - `/api/auth/change-password`

> Why not just combine them? Because the code is so different, and they serve different purposes. One will need to receive the current password to change it. The other will receive an email to send a "forgot password" email.

- [ ] Create forgot password page for non-authenticated users.
- [ ] Modify the security settings to use new API endpoint (`/api/auth/change-password`)
- [ ] Implement 2FA (expand on this when we get to it)
- [ ] Revise flow
    - When 2FA is enabled:
        - Should they need to verify email for unknown logged in devices?
        - Or verify only with 2FA
        - Will they need to verify through 2FA on ALL logins? (probably)
- [ ] Double check flow (just through the code) to ensure shit makes sense and it follows our initial plan.
- [ ] Figure out what the fuck we're gonna do with dev/production in Supabase. We'll (probably) need to update the README to clarify things or even more steps. (please never finish the other things so we never get to this painful thing)