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
- Upstash Redis

I see a lot of new apps having only 5% of authentication. Including:
- Missing login page
- No "forgot password" option
- Missing crucial security (2FA, device sessions, email alerts, and more)
- Weird UI glitches with auth
- No way to connect account to multiple providers (or delete some)
- DDoS attacks for not having proper security and API rate limiting
- HUGE bills, for lack of security again
- This list is usually longer but you get the point

These are the kind of things that should be implemented by default. You shouldn't have to forget these things, and most importantly: users expect to see these things implemented in your app. When they don't, they find it unattractive, unprofessional and sketchy.

This starter pack includes all of that, and more.

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
- API rate limiting with Upstash Redis

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
  
## Required setup

### 1. Create Supabase project
Create a Supabase project and get your ANON key and Supabase project URL.

### 2. Set up Supabase in your project
Open the `.env.example` file and replace `NEXT_PUBLIC_SUPABASE_URL` with your project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your ANON key. Example:
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

### 5. Change email templates in Supabase
1. Go to Supabase > Authentication > Email Templates
2. Paste the code into each individual template:

**Confirm signup**
```html
<h2>Confirm your signup</h2>

<p>Follow this link to confirm your user:</p>
<p><a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your mail</a></p>
```

**Reset Password**
```html
<h2>Reset Password</h2>

<p>Follow this link to reset the password for your user:</p>
<p><a href="{{ .SiteURL }}/api/auth/callback?type=recovery&token_hash={{ .TokenHash }}"></p>
```

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
14. Update your `.env.local` file to add these (this is because aside from Supabase, the project uses Resend too):
    ```diff
    - RESEND_API_KEY=your-resend-api-key
    - RESEND_FROM_EMAIL="Auth <auth@yourdomain.com>"
    + RESEND_API_KEY=your-resend-api-key
    + RESEND_FROM_EMAIL="Auth <auth@yourdomain.com>"
    ```

Congrats! 🎉 You just set up everything you need for the auth to work. You can:
- Go ahead and run `npm run dev` in the terminal, and head over to `http://localhost:3000` in the browser to test it out.
- Or if setup was too fast for you, keep reading. You'll learn about the project you're working with, optional steps (recommended for production) and more fun stuff.

No joke: 99% of auth is done for production but **when you go in production**, I really recommend you:
- go back and set up Resend if you didn't already
- set up API rate limiting

Luckily, those things are super easy to do. You literally just need to set up 2 services (Resend and Upstash Redis), get API keys and replace them in `.env.local`. The code will handle everything else automatically.

For development, do whatever you want. Set it up later if you want.

## Recommended for production
The features listed below are completely optional for development.

If you want, you can do them right away. That's up to you.

But I highly recommend you do it when you go in production.

### API Rate limiting (with Upstash Redis)
At first, the idea for implementing rate-limiting was to just create a Supabase table and store how many requests an IP made but:
- it's not fast enough for this
- need cleanup jobs for expired records
- even more complex to maintain than introducing another service
- also risk of table bloat

Yes, this does introduce another service you'll need to set up but:
- you literally need to get 2 API keys.
- takes a minute or so to do

Here's how to do it:
1. Go to this website: [https://console.upstash.com/login](https://console.upstash.com/login)
2. Create an account or log in
3. Click "create database"
4. Name it whatever you want. If unsure, just name it "auth-rate-limit"
5. Primary region: wherever you plan to host your app.
    - It should be closest to where your Next.js app is hosted, not users, since the API endpoints in this project will use it.
    - If you're just setting up rate limiting for development, anything's fine.
    - Whenever you deploy your app (eg: Vercel, Netlify) you can specify a region.
6. Choose a plan: just go free for now because:
    - You get 10K commands per day
    - With API rate limiting, each API request might use 2-3 Redis commands to:
        - Get the current request count
        - Increment it
7. Click "create"
8. Get your `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`:
    1. Scroll down to the "REST API" section
    2. Look above the code snippet, you should see them here
9. Update `.env.local` file to add these:
    ```diff
    - # UPSTASH_REDIS_REST_URL=your-upstash-redis-rest-url
    - # UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-rest-token
    + UPSTASH_REDIS_REST_URL=your-upstash-redis-rest-url
    + UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-rest-token
    ```

> In the auth config of this project (`src/config/auth.ts`) API rate limiting is already enabled by default. If you ever need (to test something for example), you can disable it in the config.

## Optional features

### SMS two-factor authentication
I really don't see why you'd do this because:
- Costs money (per SMS, monthly fees, registration fees)
- Compliance headaches (A2P 10DLC registration, carrier approvals)
- Different rates per country (good luck with that pricing)
- SMS can be delayed or fail
- Phone numbers change
- Authenticator apps are:
  - Free
  - Work offline
  - More secure
  - No compliance BS
  - No carrier drama

Good news:
- this starter does support SMS
- You don't need to dig into the code to implement it

But, consider if you really need this. The only benefit SMS has is:
- users know it
- not many even know what an authenticator app is

Though I can argue that point:
- if apps keep using SMS, users will NEVER adapt to anything more secure
- they don't know SMS isn't secure
- the more apps that start to ditch it (and introduce the apps) the faster users will adapt
- just like users adapted to making passwords more complicated (uppercase, special characters)

You know why users adapted to complex passwords? Because apps finally took ACTION.

They started throwing errors all around.

It's just a matter of time; what company is brave enough to make the move?

If you really want to flex that your auth system can do everything:

1. Create a Twilio account
    - Go to [Twilio's website](https://www.twilio.com/try-twilio)
    - Sign up for a free account
    - Verify your email and phone number
2. Get account credentials
    - After verification, you'll be taken to your console
    - If you didn't, here's a link: [Twilio Console](https://console.twilio.com/)
    - Scroll down to "Account Info"
    - You'll see:
    ```
    Account SID: AC********************************
    Auth Token: ********************************
    ```
    - We'll need to add these to Supabase in a bit. You can (temporarily) store them somewhere like a note. Just be sure to delete it when we're done.
3. Get a phone number
    - In Twilio Console, go to "Phone Numbers" > "Manage" > "Buy a number" (it's free)
    - Or direct link: [Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/search)
    - Click "Buy" on a number (trial accounts get a free number, you should have that if you just created it)
    - If you click "Configure number" you may see a warning and 2 notes
        - Don't let them overwhelm you. They just make shit seem overcomplicated for no reason.
        - First note about "A2P 10DLC":
            - Just a fancy way of saying "business texting from regular numbers"
            - US carriers want to prevent spam
            - Twilio makes businesses register their SMS use-case
            - Like telling them "yeah we're just doing 2FA codes"
            - Trial accounts can skip this (only needed for production)
        - Second note about some CSV Report:
            - Just a way to check if your numbers are registered
            - Again, trial accounts don't need this
            - It's for big companies managing lots of numbers
        - Last warning about "Emergency Address":
            - This doesn't even apply to us
            - Because we're only using SMS, no calls.
4. Create a Twilio messaging service
    - Direct link: [Create Messaging Service](https://console.twilio.com/us1/service/sms/create?frameUrl=%2Fconsole%2Fsms%2Fservices%2Fcreate%3Fx-target-region%3Dus1)
    - Friendly name: your app name (eg: My App)
    - Select "Verify users" as the use case
    - Click "Add Senders" on step 2,
    - For "Sender Type" the default should already be "Phone Number". If not, select that.
    - Click "Continue"
    - You should see the phone number listed that you bought earlier. Select it
    - Click "Add Phone Numbers"
    - Now, go to "Properties" (direct link: [Messaging Properties](https://console.twilio.com/us1/service/sms/_/messaging-service-properties?frameUrl=%2Fconsole%2Fsms%2Fservices%2FMG3fd63140e331b046c661d315701decbc%2Fproperties%3Fx-target-region%3Dus1))
    - Here, you'll find "Messaging Service SID". We're going to need this now! (along with the other things we got earlier)
5. Connect Supabase with Twilio
    - Go to Supabase [Auth Providers](https://supabase.com/dashboard/project/_/auth/providers)
    - Expand "Phone" and enable it
    - SMS provider: Twilio
    - Twilio account SID: you got this from step 2
    - Twilio auth token: and this from step 2
    - Messaging Service SID: what we just got
    - Ignore the "Twilio Content SID" field because that's for WhatsApp
    - Turn OFF "enable phone confirmation" because:
        - it would force users to enter a phone number on sign up
        - it's different from 2FA (what we're doing)
        - so users will be able to sign up with email and password
        - then later, add their phone number as 2FA for extra security
    - Click "Save"
6. Update the auth config to enable SMS as a 2FA method:
```diff
{
    title: "SMS",
    description: "Receive a verification code via SMS",
-   enabled: false,
+   enabled: true,
    type: "sms" as TTwoFactorMethod,
}
```

What you need to know:
- for development (with a trial account) you can only send SMS messages to verified numbers
- "verified numbers" is the ones you manually verify in the Twilio console
- When you signed up for an account and verified a phone number, that counts as one.
- That means, when you try out the auth with SMS, use the phone number you verified to set up 2FA,
- When going in production, scroll down to the production checklist.

## Production checklist
1. Change logo throughout app
2. Set up Supabase for production. This will be more clear once I know more about it, but:
    - check out this: [X post](https://x.com/dshukertjr/status/1880601786647728638). It seems like that's how you handle dev/production nowadays
    - or create 2 Supabase projects: one for dev and one for production. But try the one above this first.
3. Set up Resend
4. Set up Upstash Redis for API rate limiting
5. If you set up SMS for two-factor authentication:
    - Upgrade from Twilio trial account (add payment info)
    - Register for A2P 10DLC (that fancy thing for business texting)
    - Wait for carrier approval
    - Be ready for:
        - Per-message costs (~$0.0079 per SMS)
        - Monthly fees
        - Registration fees
        - Different rates per country

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

Usually, the API route responds with an error so the frontend can show it to the user.

In some cases, there is no frontend to display errors, for API routes like:
- callback
- confirm
- post-auth (after successful login/signup)

That's why we have a generic auth error page. For most stuff, the API responds with error/success.

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
Most core auth lives in API routes.

It goes like this:
- API routes: doing actual things
- Pages: show things

For example, if the user logs in:
- ❌ We don't do this in a component:
```typescript
supabase.auth.signInWithEmailAndPassword();
```
- ✅ We call an API route to logout the user:
```typescript
fetch(`/api/auth/email/${type}`)
```

Reasons:
1. Security: we never trust the client for things that need good security
2. Separation of concerns: auth lives in the API routes, components/pages handle the UI
3. Consistency: all auth flows go through API routes
4. Rate limiting: we can apply rate limiting to auth endpoints
5. Error handling: centralized error handling for auth operations
6. Logging: easier to track auth events and debug issues
7. Future-proofing: if we need to add more auth features, we know exactly where they go
8. ...probably more reasons, but you get the point.

### Difference between forgot password, change password and reset password
Notice how we got 3, very similar API routes?
- `auth/forgot-password`
- `auth/change-password`
- `auth/reset-password`

The names look similar, but they serve entirely different purposes.

-  `auth/forgot-password`: Sends a password reset email

- `auth/change-password`: Used to change the password of authenticated users. It accepts a current and new password.

- `auth/reset-password`: Part of the forgot password flow: it takes a new password and a token, which it uses to update the password.

### API routes - returning success/error response VS redirecting
We're doing both. Why? Because it's not about consistency or standardizing one approach.

It's about doing what we need it to do:
- some API endpoints need to do their own thing (redirect to error page)
- other times, you need to respond with the error so the frontend can choose what happens

**Example of when API route needs to do its thing**
Let's imagine a user signs up with Google:
1. It hits our endpoint `/api/auth/google/signin`
1. Then some OAuth stuff from Google
2. Next goes to our endpoint `/api/auth/callback`
3. And finally `/api/auth/post-auth`

There's no UI in these sequences. It's all magic server-side.

This is where we need to let the server decide what to do.

**Example of when UI needs to handle success/error**
Now let's imagine the user signs up with Email/Password:
1. Calls our API endpoint `/api/auth/email/signup`
2. If there's an error, there should be a clear error on the signup form (in the UI)
3. Redirecting to a general auth error page would be a way worse UX

Standardizing a single approach here adds zero benefits and introduces a lot of limits.

## Pro tips + note for Supabase

**Pro tip!** If you find yourself cloning this project a lot but changing same things, fork the repo, tweak what you need and clone your repo instead. That way, you can customize everything you want once and re-use whenever.

If anyone at Supabase is reading, a "fork" feature (like GitHub) would push this project even further into it's direction of making complete authentication more accessible. When a Supabase project is forked, it'd be like duplicating that project to another user.

## Who is behind this?
I'm Maze, a developer whose X bio still reads "authentication is my only enemy". That bio exists for a reason - nobody wants to build complete auth for every project, even when using great tools like Supabase. There's still a lot of code to write, edge cases to handle, and features to implement.

So I thought: "What if there was a starter pack that could just give me complete auth, problem solved?" 

That's exactly what I built. If you hit any issues, open a GitHub issue. Alternatively, hit me up on [X (Twitter)](https://x.com/mazewinther1).