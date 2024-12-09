# Auth starterpack

Start building your next.js app, not authentication. This project gives you absolutely everything you need for a real-world app. All edge cases are handled, so you don't have to.

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
1. Create a Supabase project and get your ANON key and Supabase project URL.
2. Open the .env.local file and replace `NEXT_PUBLIC_SUPABASE_URL` with your project URL and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with your ANON key. Example:
```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```
> Note: The ANON key is designed to be public! See [Reddit discussion](https://www.reddit.com/r/Supabase/comments/1fcndq7/is_it_safe_to_expose_my_supabase_url_and/) and [Supabase docs](https://supabase.com/docs/guides/api/api-keys) 
1. Head over to Supabase and within your project, click `SQL Editor` in the sidebar. Run all the following code snippets (this will set up the necessary tables, RLS policies, etc for te app to work)

**Snippet 1:**
```sql

```
... add more snippets later

That's it. Go ahead and run the app with `npm run dev`. Head over to `http://localhost:3000` and you're done! 🎉

> Pro tip: if you find yourself cloning this project a lot but changing same things, fork the repo, tweak what you need and clone your repo instead. That way, you can customize everything you need once and use whenever.