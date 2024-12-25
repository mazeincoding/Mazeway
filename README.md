# Auth Starterpack (Supabase, Next.js, Resend, Shadcn UI)

You just opened the door to the complete authentication starter pack your users will **love**.

I see a lot of new apps having only 5% of authentication. Including:
- Missing login page
- No "forgot password" option
- Missing crucial security (2FA, device sessions, email alerts, and more)
- Weird UI glitches with auth
- No way to connect account to multiple providers (or delete some)

These are the kind of things users expect to see in your app. And when they don't, they think:
- Not complete app
- Unprofessional
- Sketchy

Talking from experience, a few years ago before I was a dev.

This starter pack includes all of that. But that's not the best part.

> Clerk and other services already solve this?

Remember:
- Bootstrap
- Material UI
- Chakra UI
- Ant Design

They all solved the same problem, but created yet another one... **lack of customization**. They were very limited. Then Shadcn UI came around, and solved that problem by focusing on copy-paste components. You owned all the code, and you could customize it exactly how you wanted. It was like the ultimate UI starter pack that you could just build on.

That's exactly the difference between Clerk and this starter pack: you own all the code. It's yours! You can do whatever you want, scale it, add more things. It's the ultimate foundation of your app's authentication.

The project uses modern tech:
- Next.js 15
- Tailwind CSS
- Shadcn UI
- Supabase
- Resend

> Note: The project is very new, so expect even more sign-in methods and other cool stuff in the future. This README is complete, so you can follow it without worrying about anything being incomplete.
>
> This is not like a Zed AI documentation where it's full of "this section isn't complete" and you just know there's gonna be a million issues along the way.
>
> Though I have to be honest, I did build Zed AI some time ago with no issues. But no dev wants to read "The instructions are not yet complete".

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

### 4. Set up Supabase tables
Head over to Supabase and within your project, click `SQL Editor` in the sidebar. Run all the following code snippets (this will set up the necessary tables, RLS policies, etc for te app to work)

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
-- Step 1: Create the device_sessions table
CREATE TABLE device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  -- We'll add the device_id column later.
  -- This is because we need to create the devices table first, in order to reference it.
  access_level text CHECK (access_level IN ('full', 'verified', 'restricted')) DEFAULT 'restricted',
  verification_level text CHECK (verification_level IN ('none', 'light', 'full')) DEFAULT 'none',
  confidence_score integer DEFAULT 0,
  needs_verification boolean DEFAULT false,
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
USING (auth.uid() = user_id);

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
**Add device_id column to device_sessions table**
```sql
ALTER TABLE device_sessions ADD COLUMN device_id uuid REFERENCES devices(id) ON DELETE CASCADE;
```

### 5. Change the confirm signup in Supabase
1. Go to Supabase and click `Authentication` in the sidebar.
2. The template should already be set to `Confirm signup`. If it's not, click it.
3. In the code, change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
4. Scroll down and click `Save`

### 6. Enable Google OAuth
> Note: The project comes with Google OAuth out of the box. This is done as it's becoming increasingly popular. If you don't want it at all, you can remove it from the codebase.

**Get your Google OAuth credentials**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)

**Enable Google OAuth in Supabase**
1. Create/select project in console
2. Go to: [https://console.cloud.google.com/apis/credentials/consent](https://console.cloud.google.com/apis/credentials/consent)
3. Choose `External`. (`Internal` may be enabled)
4. Write your app name in the `App name` field
5. On the `user support email` dropdown, select your email here
6. You can upload a logo if you want. The auth will work either way (though imagine it didn't)
7. Scroll down to the `Authorized domains` heading and click the `ADD DOMAIN` button. Enter your Supabase project URL here. It's the same URL as the one you got earlier which you put into your `.env.local` file. Should look like `<PROJECT_ID>.supabase.co`.

    > Note: The URL shouldn't include the `https://` part

8. Scroll down to the `Developer contact information` heading and add your email.
9. Go to: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
10. Click `create credentials`
11. choose `OAuth Client ID`.
12. For `Application type`, choose `Web application`.
13. Under `Authorized JavaScript origins`, add your site URL. That's `http://localhost:3000`.

14. Under `Authorized redirect URLs`, enter the `callback URL` from the Supabase dashboard. To get it, follow these steps:
    1. Go to your Supabase dashboard
    2. In the sidebar, click "Authentication" and then click "Providers" to the left side and scroll down until you see `Google`
    3. Click to expand Google. Here, you'll find a field labeled `Callback URL (for OAuth)`.

15. Hit `create` in the Google console and you will be shown your `Client ID` and `Client secret`
16. Copy the `Client ID` and `Client secret`, go back to Supabbase and paste those. Then click `Save`

If you have trouble following along, you can check the official docs [here](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Set up Resend (optional)

Supabase (as of now) does give you 2 free emails per hour!

So you can totally ignore this step for now and set it up later.

Especially since Resend requires you to have bought a domain.

The project does use Resend specifically for sending a security email (someone logged in to your account) and you won't see that email until you set up Resend. But everything else will work just fine.

I do recommended you set it up when you go in production.

Here's how to do it when you need it:

**Luckily...**
Resend makes it REALLY straightforward to integrate with Supabase.

You won't even need to touch the Supabase dashboard to do it.

1. Go to the [Resend website](https://resend.com)
2. Create an account/login
3. In the left sidebar, go to `Domains` and add a domain here
   
    > Note: You will need a paid domain for this as mentioned above.
    
    > You can add any domain by the way. I'm on the Resend free tier so I added my personal domain (mazewinther.com). You know why? Because the free tier only gets you 1 domain, so by using my personal domain, I can re-use it for all of my apps and it still makes sense.
    >
    > If I were to add my app's domain, it'd only really make sense to use for that one app.
    >
    > If you're on a paid tier, just add your app's domain because you can have multiple domains. This is only a tip for people who wan't wanna spend money right away.
    >
    > Though Resend is really amazing, and I'd probably subscribe just to support the service itself.

4. Follow the steps by Resend. From experience, verifying the domain might be the most painful part, especially when it doesn't work no matter what you do. It's really like rolling a dice. If it lands on 6, everything verifies! Otherwise, try again. Hit me up on [X (Twitter)](https://x.com/mazewinther1) or send me an [Email](mailto:support@mazewinther.com) if you're having trouble and I'll personally help you.
5. Now, again in the left sidebar, go to `Settings`
6. Then, go to `Integrations` (this is where the magic is)
7. You should see Supabase listed. Click `Connect to Supabase`
8. Resend will request access to your Supabase organization. Click `Authorize Resend`
9. Select your Supabase project
10. Select the domain you just added
11. Configure custom SMTP (this sounds super complicated but it's not. It's already configured. Just change the `Sender name` and click `Configure SMTP integration`)
12. Update your `.env.local` file:
    ```diff
    NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
    + RESEND_API_KEY=your-resend-api-key
    + RESEND_FROM_EMAIL="Auth <auth@yourdomain.com>"
    NEXT_PUBLIC_SITE_URL=http://localhost:3000
    ```

That's literally it. You just set up an entire authentication system (that users will appreciate) probably in minutes.

Go ahead and run the app with `npm run dev`. Head over to `http://localhost:3000` and you're done! 🎉

## Get to know the project better
Gonna implement this section later.

This is where we're gonna explain how everything works.

So people know what they're working with.

We should write it in simple terms, breaking complex things into things that just makes sense.

Pro tip: if you find yourself cloning this project a lot but changing same things, fork the repo, tweak what you need and clone your repo instead. That way, you can customize everything you want once and re-use whenever.

If anyone at Supabase is reading, a "fork" feature (like GitHub) would push this project even further into it's direction of making complete authentication more accessible. When a Supabase project is forked, it'd be like duplicating that project to another user.

## Who is behind this?
I'm Maze. I love authentication so much that I decided to build this, so I never have to do auth again. If you hit any issues, DM me on [X](https://x.com/mazewinther1) and I'll help you out or just open a GitHub issue. Whatever works best for you.