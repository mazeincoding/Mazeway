# Setting Up Dev/Prod Environments

Let's make this painless. Here's exactly how to set up your Mazeway auth project for both development and production.

## Two projects approach (the FREE way)

Supabase has a fancy "branching" feature they love to talk about, but surprise - it's actually paywalled at $0.32 PER DAY PER BRANCH on the Pro plan ($25/mo). That's right, they don't mention the paywall until you try to enable it.

So here's the ACTUAL way most developers do it without paying extra:

### Setting up separate projects:

1. You need two Supabase projects:
   - One for development (e.g., "my-app-dev") if you followed the README, you already have this
   - One for production (e.g., "my-app-prod")

2. Set up each project with the same schema:
   - Run the exact same SQL setup scripts from the README on both projects
   - Or use [Supabase CLI migrations](https://supabase.com/docs/guides/cli/local-development#database-migrations) to keep them in sync
   
3. That's it! Now you have:
   - A dev environment you can mess with freely
   - A production environment that stays clean

## Google OAuth configuration

Google OAuth needs to know ALL the domains your app will run on. Here's how to set it up for both environments:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID (the one we created during setup)
3. Under "Authorized JavaScript origins" add BOTH:
   ```
   http://localhost:3000
   https://your-production-domain.com
   ```
4. Under "Authorized redirect URIs" add BOTH:
   ```
   https://your-dev-project-url.supabase.co/auth/v1/callback
   https://your-prod-project-url.com/api/auth/callback
   ```
5. Click "Save"

## Environment variables

With the two-project approach, you'll have different credentials for each environment:

### For local development:
Your `.env.local` file should have:
```
NEXT_PUBLIC_SUPABASE_URL=your-dev-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-dev-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### For production (like Vercel):
I'm gonna use Vercel as an example here but this applies to any deployment platform:

When deploying to Vercel, you MUST update your environment variables:

1. Go to your Vercel project dashboard
2. Click on "Settings" → "Environment Variables"
3. Add the following variables with your PRODUCTION values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-prod-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-prod-service-role-key
   NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
   ```
4. Click "Save"

Click "redeploy" on your latest deployment for the changes to take effect.

⚠️ **IMPORTANT**: If you skip this step, your production site will connect to your development database!

## Configure Supabase Auth for production

When setting up your production Supabase project, you MUST configure both the Site URL and Redirect URL in Auth settings:

1. Go to [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/_/auth/url-configuration)
2. Set the Site URL to your production domain (e.g., `https://your-production-domain.com`)
3. Add a Redirect URL for your production site: `https://www.your-production-domain.com/api/auth/callback`
4. Save the changes

⚠️ **IMPORTANT**: If you skip these steps, authentication redirects will fail in production!

## Managing schema changes
When you make schema changes, you'll need to apply them to both projects. There are two main approaches:

### 1. Manual Approach (Quick & Simple)
Write down the changes you make to the dev project. When you're ready to apply them to production, do them manually on the production Supabase project again.

### 2. Migrations approach (more fancy, still free)
Use the Supabase CLI to create and run migrations:

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Initialize Supabase in your project:
   ```bash
   supabase init
   ```

3. Create a migration when you make a change:
   ```bash
   supabase migration new add_new_column
   ```

4. Edit the created migration file in `supabase/migrations/` with your SQL

5. Apply to development:
   ```bash
   supabase db push --db-url=your-dev-db-connection-string
   ```

6. Apply to production when ready:
   ```bash
   supabase db push --db-url=your-prod-db-connection-string
   ```

## Deployment workflow

Here's what a typical workflow looks like:

1. Develop locally with `npm run dev` using your dev environment vars
2. Make and test changes in your development environment
3. When ready to deploy:
   - Apply any database changes to production
   - **Update environment variables in Vercel** to point to your production Supabase project
   - Deploy your Next.js app to production
   - Verify everything is working on the live site

## Common gotchas

- **Schema drift**: If your dev and prod databases get out of sync, you'll have weird bugs
- **Auth settings**: Double-check auth providers are configured the same on both projects
- **Forgot something?**: Use the Supabase dashboard to compare settings between projects

## Quick sanity checks

If something's not working, check these first:

1. Are your environment variables pointing to the correct project?
2. Is your `NEXT_PUBLIC_SITE_URL` matching the actual URL?
3. Did you add all domains to Google OAuth?
4. Did you forget to apply a database change to production?

That's it! Following this guide lets you have separate dev and prod environments without paying for Supabase's overpriced branching feature. 🎉 

## *For the Rich Folks: Supabase Branching (the $$$$ way)*

If you really want the fancy-pants branching feature and don't mind paying extra (jokes aside, it's really cool), you can:

1. Upgrade to Supabase Pro Plan ($25/month)
2. Click "Enable branching" in the Database section
3. Pay $0.32 per day per branch
4. Connect your GitHub repo
5. Feel special