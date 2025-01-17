# Auth Starterpack (Supabase, Next.js, Resend, Shadcn UI)

You just opened the door to the complete authentication starter pack your users will **love**.

> How is this project different from Clerk and other auth solutions?

Remember:
- Bootstrap?
- Material UI?
- Chakra UI?
- Ant Design?

They all solved the same problem, but created yet another one... **lack of customization**. They were very limited. Then Shadcn UI came around, and solved that problem by focusing on copy-paste components. You owned all the code, and you could customize it exactly how you wanted. It was like the ultimate UI starter pack that you could just build on.

That's exactly the difference between Clerk and this starter pack: you own all the code. It's yours! You can do whatever you want, scale it, add more things. It's the ultimate foundation of your app's authentication.

The project uses modern tech:
- Next.js 15
- Tailwind CSS
- Shadcn UI
- Supabase
- Resend

I see a lot of new apps having only 5% of authentication. Including:
- Missing login page
- No "forgot password" option
- Missing crucial security (2FA, device sessions, email alerts, and more)
- Weird UI glitches with auth
- No way to connect account to multiple providers (or delete some)

These are the kind of things users expect to see in your app. And when they don't, they think:
- "This app is not complete"
- "It's unprofessional"
- "Seems sketchy"

This starter pack includes all of that.

## The project comes with:
- Sign-in options:
    - `Email/password`
    - `Google`
- Complete authentication flow:
  - Login/signup pages
  - Password reset
  - Email verification
  - Sign-in confirmation
  - Two-factor authentication (2FA)
- User settings dashboard
  - Profile management
  - Change password
  - Device session management
    - View active sessions
    - Revoke device access
    - Email alerts for new logins

> Unlike many docs written after-the-fact, the following steps were created in real-time as I built the project. Each step was immediately documented after being successfully completed. I'd do one step at a time and then add that step.

### ⚠️ Important notice
The project is not done yet! It's not recommended to use in production until security gaps are fixed and the core auth feature are implemented fully. Changes are still being made to this README (like database updates, setup changes). You can come back to this repo and soon enough, it should be ready.

### 2025 Name change
Changed the GitHub repo name from Auth-Starter to Mazeway because:
- More specific
- Easier to remember
- It's an actual name
- Auth is a maze:
    - Multiple paths to navigate (email, social, 2FA)
    - Easy to get lost (forgot password, security)
    - Need a clear route for users to follow
  
## Setup
Just a few steps and your authentication is **production ready**. Let's set everything up using the steps below:

### 1. Create Supabase project
Create a Supabase project and get your ANON key and Supabase project URL.

### 2. Set up Supabase in your project
Open the .env.example file and replace `NEXT_PUBLIC_SUPABASE_URL` with your project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your ANON key. Example:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Rename the `.env.example` file to `.env.local`
> Note: The ANON key is designed to be public! See [Reddit discussion](https://www.reddit.com/r/Supabase/comments/1fcndq7/is_it_safe_to_expose_my_supabase_url_and/) and [Supabase docs](https://supabase.com/docs/guides/api/api-keys) 

### 4. Install dependencies
In the terminal, go ahead and run this:
```bash
npm install --legacy-peer-deps
```
The `--legacy-peer-deps` flag is just because this project uses react 19, and not a lot of npm packages support that. You might get errors without the flag, so this should solve them.

### 4. Set up Supabase tables
Head over to Supabase and within your project, click "SQL Editor" in the sidebar. Run all the following code snippets (this will set up the necessary tables, RLS policies, etc for te app to work)

**Create update_updated_at function**
```sql
-- Create a function to update the "updated_at" column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Create the user table**
```sql
-- Step 1: Create the users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  avatar_url text,
  auth_method text CHECK (auth_method IN ('email', 'google')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable Row-Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies

-- Allow users to insert their own data
CREATE POLICY "Allow user to insert their own data"
ON users
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Allow users to select their own data
CREATE POLICY "Allow user to select their own data"
ON users
FOR SELECT
USING (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Allow user to update their own data"
ON users
FOR UPDATE
USING (auth.uid() = id);

-- Allow users to delete their own data
CREATE POLICY "Allow user to delete their own data"
ON users
FOR DELETE
USING (auth.uid() = id);

-- Step 4: Create trigger to update the "updated_at" column using the function we just created
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Create device sessions table**
```sql
CREATE TABLE device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  -- We'll add the device_id column later.
  -- This is because we need to create the devices table first, in order to reference it.
  is_trusted boolean DEFAULT false,
  needs_verification boolean DEFAULT false,
  confidence_score integer DEFAULT 0,  -- Keep this!
  last_verified timestamp with time zone,
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable Row-Level Security
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies

-- Allow users to insert their own device sessions
CREATE POLICY "Allow users to insert their own device sessions"
ON device_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own device sessions
CREATE POLICY "Allow users to view their own device sessions"
ON device_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own device sessions
CREATE POLICY "Allow users to update their own device sessions"
ON device_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  -- Can never modify security columns through client-side queries
  (is_trusted IS NOT DISTINCT FROM OLD.is_trusted) AND
  (needs_verification IS NOT DISTINCT FROM OLD.needs_verification)
);

-- Allow users to delete their own device sessions
CREATE POLICY "Allow users to delete their own device sessions"
ON device_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- Step 4: Create trigger to update the "updated_at" column
CREATE TRIGGER update_device_sessions_updated_at
BEFORE UPDATE ON device_sessions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Create indexes for faster queries
CREATE INDEX idx_device_sessions_user_id ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_device_id ON device_sessions(device_id);
```
**Create devices table**
```sql
-- Create devices table
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  browser text,
  os text,
  ip_address text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow any authenticated user to insert devices"
ON devices
FOR INSERT
TO authenticated;

CREATE POLICY "Allow users to view their devices"
ON devices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM device_sessions 
    WHERE device_sessions.device_id = devices.id 
    AND device_sessions.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```
**Add device_id column to device_sessions table** (now we can run this because we have the devices table)
```sql
ALTER TABLE device_sessions ADD COLUMN device_id uuid REFERENCES devices(id) ON DELETE CASCADE;
```
**Create verification codes table**
```sql
-- Create verification_codes table
CREATE TABLE verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_session_id uuid REFERENCES device_sessions(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow users to insert verification codes for their devices"
ON verification_codes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM device_sessions
    WHERE device_sessions.id = verification_codes.device_session_id
    AND device_sessions.user_id = auth.uid()
  )
);

-- Allow users to view their own verification codes
CREATE POLICY "Allow users to view their own verification codes"
ON verification_codes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM device_sessions
    WHERE device_sessions.id = verification_codes.device_session_id
    AND device_sessions.user_id = auth.uid()
  )
);

-- Allow users to delete their own verification codes
CREATE POLICY "Allow users to delete their own verification codes"
ON verification_codes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM device_sessions
    WHERE device_sessions.id = verification_codes.device_session_id
    AND device_sessions.user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_verification_codes_updated_at
BEFORE UPDATE ON verification_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_verification_codes_device_session_id 
ON verification_codes(device_session_id);

-- Create index for faster expiry cleanup
CREATE INDEX idx_verification_codes_expires_at 
ON verification_codes(expires_at);
```

### 5. Change the confirm signup in Supabase
1. Go to Supabase and click "Authentication" in the sidebar.
2. The template should already be set to "Confirm signup". If it's not, click it.
3. In the code, change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
4. Scroll down and click "Save"

### 6. Enable Google OAuth
> Note: The project comes with Google OAuth out of the box. This is done as it's becoming increasingly popular. If you don't want it at all, you can remove it from the codebase.

**Get your Google OAuth credentials**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)

**Enable Google OAuth in Supabase**
1. Create/select project in console
2. Go to: [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
3. Choose "External". ("Internal" might be disabled)
4. Enter your app name in the "App name" field (ex: auth-starter)
5. Click the "user support email" dropdown and select your email here
6. You can upload a logo if you want. The auth will work either way
7. Scroll down to the "Authorized domains" heading and click the "ADD DOMAIN" button. Enter your Supabase project URL here. It's the same URL as the one you got earlier which you put into your `.env.local` file. Should look like `<PROJECT_ID>.supabase.co`.

    > Note: The URL shouldn't include the `https://` part

8. Scroll down to the "Developer contact information" heading and add your email.
9. Go to: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
10. Click "create credentials"
11. Choose "OAuth Client ID".
12. For "Application type", choose "Web application".
13. Under "Authorized JavaScript origins", add your site URL. That's `http://localhost:3000`.
14. Under "Authorized redirect URLs", enter the "callback URL" from the Supabase dashboard. To get it, follow these steps:
    1. Go to your Supabase dashboard
    2. In the sidebar, click "Authentication" and then click "Providers" to the left side and scroll down until you see "Google"
    3. Click to expand Google. Here, you'll find a field labeled "Callback URL (for OAuth)"".

15. Hit "create" in the Google console and you will be shown your "Client ID" and "Client secret"
16. Copy those, go back to Supabbase and paste those. Then click "Save"

If you have trouble following along, you can check the official docs [here](https://supabase.com/docs/guides/auth/social-login/auth-google). You can also open a GitHub issue, or just contact me directly [X](https://x.com/mazewinther1) [Email](emailto:hi@mazecoding.com)

### 7. Set up Resend (optional)
Supabase (as of now) does give you 2 free emails per hour (for development) but it's unreliable. Sometimes, unclear errors will pop up because of their SMTP and you'll spend 2 hours debugging.

You can totally skip this step for now (during development) but be mindful that if auth doesn't work, setting up a custom SMTP will probably solve it.

Aside from that, the project uses Resend for:
- login alerts
- device verification

If you don't set up Resend:
- The code won't attempt to use Resend at all
- All devices will be "trusted" by default, which doesn't matter for development but important for production
- Supabase might hate you for using their free email service, but that's their own fault

When you go in production, I recommend you set it up. Because:
- you just need to get an API and put it in the environment variables (`.env.local`).
- you don't need to change any code
- auth should be secure in production

With that out the way, here's how to do it:

**Luckily...**
Resend makes it REALLY straightforward to integrate with Supabase.

You won't even need to touch the Supabase dashboard to do it.

1. Go to the [Resend website](https://resend.com)
2. Create an account/login
3. In the left sidebar, go to "Domains" and add a domain here
   
    > Note: You will need a paid domain for this as mentioned above.
    
    > You can add any domain by the way. I'm on the Resend free tier so I added my personal domain (mazewinther.com). You know why? Because the free tier only gets you 1 domain, so by using my personal domain, I can re-use it for all of my apps and it still makes sense.
    >
    > If I were to add my app's domain, it'd only really make sense to use for that one app.
    >
    > If you're on a paid tier, just add your app's domain because you can have multiple domains. This is only a tip for people who wan't wanna spend money right away.
    >
    > Though Resend is really amazing, and I'd probably subscribe just to support the service itself.

4. If you already have a domain here (that you wanna use) you can skip this. But if you don't got one (or want a new one) follow the steps by Resend. From experience, verifying the domain might be the most painful part, especially when it doesn't work no matter what you do. It's really like rolling a dice. If it lands on 6, everything verifies! Otherwise, try again. Hit me up on [X (Twitter)](https://x.com/mazewinther1) or send me an [Email](mailto:hi@mazecoding.com) if you're having trouble and I'll personally help you. You can also open a GitHub issue.
5. In the left sidebar again, go to "API Keys" and click "Create API key"
6. Just enter a name for the API key (like your app name), then change "permission" to "Sending access" and click the "Domain" field to change it to the one you just added
7. Now, again in the left sidebar, go to "Settings"
8. Then, go to "Integrations" (this is where the magic is)
9. You should see Supabase listed. Click "Connect to Supabase"
10. Resend will request access to your Supabase organization. Click "Authorize Resend"
11. Select your Supabase project
12. Select the domain you just added
13. Configure custom SMTP (this sounds super complicated but it's not. It's already configured. Just change the `Sender name` and click `Configure SMTP integration`)
14. Update your `.env.local` file to add these:
    ```diff
    + RESEND_API_KEY=your-resend-api-key
    + RESEND_FROM_EMAIL="Auth <auth@yourdomain.com>"
    ```

Congrats! 🎉 You just set up everything you need for the auth to work. You can:
- Go ahead and run `npm run dev` in the terminal, and head over to `http://localhost:3000` in the browser to test it out.
- Or if setup was too fast for you, keep reading. You'll learn about the project you're working with, optional steps (recommended for production) and more fun stuff.

No joke: 99% of auth is done for production but when you go in production, I really recommend you:
- go back and set up Resend
- set up API rate limiting

Luckily, those things are super easy to do. You literally just need to set up 2 services (Resend and Redis), get API keys and replace them in `.env.local`. The code will handle everything else automatically.

For development, do whatever you want. Set it up later if you want.

## Get to know the project better

### Types: where they are and why the naming convention
You might notice in the types (`/types`) we define interfaces and types with a prefix of "T". This is intentional to avoid name conflicts with components vs types.

Examples:
`TUser`
`TAuthError`

### API routes VS server actions: Why we use API routes
Server actions are just HTTP post requests. They seem "locked down" but they aren't entirely.

When this project started, I actually went with server actions for most things because I thought they were locked down to this Next.js app only. And I get it, it's not as straightforward as a simple API call but with enough digging, you could call the server actions.

What does that mean for security? They would need to have the same security checks as API routes (authorization)

So at this point, server actions end up with more downsides:
- Can't use routes outside of Next.js app (for mobile app etc)
- The `/auth/callback` and `/auth/confirm` routes need to be API routes because they're used by external services (OAuth)
- At that point, we'd end up with inconsistency

Pretty simple: we can't ONLY use server actions because of the OAuth routes. We CAN use only API routes though, and they allow us to use them from anywhere outside the Next.js app in the future.

### How auth errors work
The /auth/error page is just for generic, "can't recover" errors.

That's why if device verification fails for example, you'll see we redirect to `/auth/verify-device` (in `src/app/api/auth/complete`). Because:
- Verification errors are not "generic"
- User can recover from error (send verification code again)
- Stays in context with device verification

### Email templates
Most templates will actually be in your Supabase dashboard. The ones you can find in there are:
- Confirm sign up
- Invite user
- Magic Link
- Change Email Address
- Reset Password
- Reauthentication

All other email templates live in this project in `/emails/templates`. You'll find:
- Verify device (`/emails/templates/device-verification.tsx`)
- Log in alert (`/emails/templates/email-alert.tsx`)

Separating the email templates wasn't a design choice. Supabase didn't have these security features built-in, so we had to do it ourselves.

Now: coolest thing ever? It uses react-email (which makes it cool). Watch this:

try running this command in the terminal:
```bash
npx react-email dev
```

It should give you a localhost URL (eg: `http://localhost:3000`). Just copy that and paste it into the browser.

Next, expand "templates" in the sidebar and click any templates. You can preview them here! 🎉

### Auth config
To make things a little more manageable, there's a config file for the auth.

With this, you don't need to touch the core auth to make small tweaks (which could be risky if you don't know what you're doing). Of course, you will if there's no configuration for it. But there should be for most things that people would commonly change.

The config file is at `/config/auth.ts`.

### Separation of concerns
There's a reason for why you might see almost all, if not all auth logic is in API routes:
- email login/signup
- google sign in
- forgot password
- reset password
- device sessions
... and more

It's so devs like you don't need to touch the core auth to make changes.

Wanna change the UI? You can do that without touching the auth itself.

### Difference between forgot password and change password
Notice how we have these:
- `/api/auth/forgot-password`
- `/api/auth/change-password`

And pages:
- `auth/forgot-password`
- `auth/change-password`

The reason: they serve different purposes.

At first, I thought we could just combine them but that doesn't make sense.

One focuses on sending an email, the other actually changes the password.

## Optional features

### API Rate limiting (with Upstash Redis)
[add setup here]

## Steps to production
1. Change logo throughout app
2. Set up Supabase for production (including OAuth from Google cloud console)

**Pro tip!** If you find yourself cloning this project a lot but changing same things, fork the repo, tweak what you need and clone your repo instead. That way, you can customize everything you want once and re-use whenever.

If anyone at Supabase is reading, a "fork" feature (like GitHub) would push this project even further into it's direction of making complete authentication more accessible. When a Supabase project is forked, it'd be like duplicating that project to another user.

## Who is behind this?
I'm Maze, a developer whose X bio still reads "authentication is my only enemy". That bio exists for a reason - nobody wants to build complete auth for every project, even when using great tools like Supabase. There's still a lot of code to write, edge cases to handle, and features to implement.

So I thought: "What if there was a starter pack that could just give me complete auth, problem solved?" 

That's exactly what I built. If you hit any issues, open a GitHub issue. Alternatively, hit me up on [X (Twitter)](https://x.com/mazewinther1).