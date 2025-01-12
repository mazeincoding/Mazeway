- [x] Implement device sessions and verification for untrusted devices
- [ ] Create device session email template
- [ ] Preview the UI of all email templates and tweak if needed
- [ ] Figure if Supabase has a "reset password" email template
    - If they do: we can use it
    - Otherwise, we'll need to create that too
- [ ] Create API endpoints for changing/forgot password:
    - `/api/auth/forgot-password`
    - `/api/auth/change-password`

> Why not just combine them? Because the code is so different, and they serve different purposes. One will need to receive the current password to change it. The other will receive an email to send a "forgot password" email.

- [ ] Create forgot password page for non-authenticated users.
- [ ] Modify the security settings to use new API endpoint (`/api/auth/change-password`)
- [ ] Implement 2FA (expand on this when we get to it)
- [ ] Double check flow (just through the code) to ensure shit makes sense and it follows our initial plan.