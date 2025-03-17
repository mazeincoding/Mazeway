# Contributing to Auth Starterpack

First off, you're awesome for wanting to contribute! 🎉

## Important notice - 27th December 2024

Hey there! The core authentication system is currently going through some deep architectural decisions. We're talking:
- Device trust models
- Session management complexity
- Security implications
- Confidence calculations
- Verification flows

### Why is this off-limits?
Authentication requires a single, focused mind making interconnected decisions. Just today:
1. I redesigned how device trust works
2. Questioned how sessions should persist
3. Rethought device verification
4. Discovered new security implications
5. Changed core approaches multiple times

### What this means
I need to keep the core auth work isolated until these decisions are final. Otherwise:
```
PR: "Added verification levels!"
Me: "Actually we don't need those..."

PR: "Updated session management!"
Me: "Just realized sessions should work differently..."
```

Don't worry! Once the core auth is solid and decisions are final, there will be plenty of ways to contribute. For now, this helps avoid you working on code that might be completely different tomorrow.

✅ UPDATE

The core auth is finally ready! You can ignore the above warning. It will go away March 20th.

Contribute away!

### 3. Found a bug?
Here's how to report it:
1. Check if someone already reported it in [Issues](https://github.com/mazeincoding/Auth-Starter)
2. If not, create a new one with:
   - How to make the bug happen
   - What should happen
   - What actually happens
   - Screenshots if you can
   - Your browser (Chrome, Safari, etc)

## Want to contribute code?

1. Fork the repo
2. Create your feature branch:
   ```bash
   git checkout -b feature/awesome-feature
   ```
3. Make your changes
4. Test everything works
5. Push to your fork
6. Open a Pull Request

## Pull Request Tips

Keep these in mind:
- Focus on one thing at a time
- Follow the existing style
- Update docs if needed
- Explain your changes clearly

## Need help?

You can either:
- DM me directly on [X/Twitter](https://x.com/mazewinther1)
- Open a GitHub issue
- Email me at hi@mazewinther.com

## What this project is about

Think of this as the authentication foundation that developers can actually build on. Just like how Shadcn UI revolutionized UI components by making them customizable, we're doing the same for auth.

We focus purely on authentication. That means:
- ✅ Email verification
- ✅ Device management
- ✅ Security alerts
- ✅ Basic user settings (email, password, name)
- ❌ In-app notifications (not auth-related)
- ❌ User profiles (usernames, bios, profile pages, etc)

This keeps the project focused while giving developers a solid foundation they can extend.

We also like simple solutions. That way, the project is easier to pick up on.

## Be awesome to each other

A few ground rules:
- Be kind and helpful
- Focus on solutions, not blame
- Welcome newcomers
- Share knowledge

Let's make authentication great again!