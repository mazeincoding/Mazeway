# Auth starterpack

Start building your next.js app, not authentication. This project gives you absolutely everything you need for a real-world app. All edge cases are handled, so you don't have to. Built with Supabase.

> Note: The project is very new, so expect even more sign-in methods and other cool shit in the near future. This README is complete, so you can follow it without worrying about if anything is incomplete.

## The project comes with:
- Sign-in options:
    - `Email/password`
    - `Google`
- Complete authentication flow:
  - Login/signup pages
  - Password reset
  - Email verification
  - Sign-in confirmation
- User settings dashboard
  - Profile management
  - Change password
  
## Usage
This is as simple as it can get. This is all the steps:
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
...add more snippets later

### 5. Change the confirm signup in Supabase
1. Go to Supabase and click `Authentication` in the sidebar.
2. The template should already be set to `Confirm signup`. If it's not, click it.
3. In the code, change `{{ .ConfirmationURL }}` to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
4. Scroll down and click `Save`

That's it. Go ahead and run the app with `npm run dev`. Head over to `http://localhost:3000` and you're done! 🎉

> Pro tip: if you find yourself cloning this project a lot but changing same things, fork the repo, tweak what you need and clone your repo instead. That way, you can customize everything you need once and use whenever.