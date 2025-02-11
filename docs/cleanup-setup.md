# Setting up Session Cleanup

This setup is a bit annoying right now. You need:
- Docker installed
- Supabase CLI
- Some patience

And when I say "annoying" - it's not even bad. My standards for documentation are just high.

## Setting up Docker
If you don't have Docker yet:

1. Install Docker Desktop:
   - Windows/Mac: Download from [Docker's website](https://www.docker.com/products/docker-desktop)
   - Linux: Follow [these steps](https://docs.docker.com/desktop/install/linux-install)

2. Get Docker running:
   - Windows/Mac: Start Docker Desktop (it's an app on your PC)
   - Linux: Either start Docker Desktop if you installed it, or run `sudo systemctl start docker`
   - Wait for the whale icon 🐋 in your taskbar (Windows/Mac) or check status with `docker info`
   - Run `docker ps` to check it's working. If it's running, you'll see:
     ```bash
     CONTAINER ID   IMAGE   COMMAND   CREATED   STATUS   PORTS   NAMES
     # Empty list is fine! Just means no containers running yet
     ```
   - If you get "permission denied" or "cannot connect" errors on Linux, run:
     ```bash
     sudo groupadd docker
     sudo usermod -aG docker $USER
     # Then log out and back in
     ```

## 1. Set up Supabase CLI
```bash
# First, try this
npx supabase login

# If that fails, install it globally and try again
npm install supabase --global
npx supabase login
```

## 2. Create and Deploy the Function

Run these commands:
```bash
# Create and set up the function
npm run setup:cleanup

# Deploy it
npm run deploy:cleanup
```

> Using VS Code? You'll probably see this error:
> ```
> Uncached or missing remote URL: https://esm.sh/@supabase/supabase-js@2.38.4
> ```
> It's nothing crazy. Just:
> 1. Install the "Deno" extension in VS Code (rip if you use Vim)
> 2. Press `CTRL + Shift + P` (or `CMD + Shift + P` on Mac)
> 3. Type "Deno: Initialize Workspace Configuration" and hit enter
> 4. Wait a bit - VS Code might take a minute to clear the error
> 
> The error is just VS Code being picky about Deno imports. Your function will work fine.

If you get Docker errors, make sure:
1. Docker Desktop is installed and running
2. You're logged into Docker
3. Your internet isn't being weird

## 3. Environment Variables

No setup needed! Supabase automatically sets up all the environment variables we need for the cleanup function 🎉

## 4. Enable Database Extensions

1. Go to [Database Extensions](https://supabase.com/dashboard/project/_/database/extensions)
2. Enable these extensions if they aren't already:
   - `pg_cron` - for scheduling the cleanup
   - `pg_net` - for making HTTP calls to our function

## 5. Schedule the Cleanup

1. Go to [SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Run this SQL (replace `<PROJECT_ID>` with your project ID and `<ANON_KEY>` with your ANON key, keep reading to find them):
   ```sql
   SELECT cron.schedule(
     'cleanup-expired-sessions',  -- name of the cron job
     '0 0 * * *',               -- run at midnight every day
     $$
     SELECT net.http_post(
       url:='https://<PROJECT_ID>.supabase.co/functions/v1/cleanup-expired-sessions',
       headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb
     );
     $$
   );
   ```
   You need:
   - Project ID: find it [here](https://supabase.com/dashboard/project/_/settings/general)
   - Anon key: it's in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

That's it! The cleanup will run every midnight.

## Test the Cleanup
Let's create a test session and see if the cleanup works:

1. Go to [SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Create and run this test function (replace `<PROJECT_ID>` and `<ANON_KEY>` with the same values you entered earlier):
   ```sql
   -- Create a function that sets up test data and runs cleanup
   CREATE OR REPLACE FUNCTION test_cleanup_function()
   RETURNS text AS $$
   DECLARE
     test_user_id uuid;
     test_device_id uuid;
     test_session_id uuid;
     session_count integer;
     request_id bigint;
     response record;
     headers jsonb;
   BEGIN
     -- Create a test user first
     INSERT INTO auth.users (id, email)
     VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com')
     RETURNING id INTO test_user_id;

     -- Create corresponding user in public schema
     INSERT INTO users (id, email, name)
     VALUES (test_user_id, 'test@example.com', 'Test User');
     
     -- Create a test device
     INSERT INTO devices (user_id, device_name)
     VALUES (test_user_id, 'Test Device')
     RETURNING id INTO test_device_id;
     
     -- Create an expired session
     INSERT INTO device_sessions (
       user_id,
       session_id,
       device_id,
       is_trusted,
       needs_verification,
       confidence_score,
       expires_at
     )
     VALUES (
       test_user_id,
       gen_random_uuid(),
       test_device_id,
       false,
       false,
       70,
       NOW() - INTERVAL '1 day'
     )
     RETURNING session_id INTO test_session_id;
     
     -- Verify session was created
     SELECT COUNT(*) INTO session_count
     FROM device_sessions
     WHERE user_id = test_user_id;
     
     IF session_count = 0 THEN
       RETURN 'Failed to create test session';
     END IF;
     
     RAISE NOTICE 'Test session created successfully. Count: %', session_count;
     
     -- Prepare headers as jsonb
     headers := jsonb_build_object(
       'Content-Type', 'application/json',
       'Authorization', 'Bearer <ANON_KEY>'
     );
     
     -- Run cleanup function and get request ID
     SELECT net.http_post(
       'https://<PROJECT_ID>.supabase.co/functions/v1/cleanup-expired-sessions',
       headers
     ) INTO request_id;
     
     RAISE NOTICE 'Cleanup function called. Request ID: %', request_id;
     
     -- Wait for the request to complete
     PERFORM pg_sleep(3);
     
     -- Get the response from _http_response table
     SELECT status_code, content::jsonb, error_msg
     INTO response
     FROM net._http_response
     WHERE id = request_id;
     
     RAISE NOTICE 'Response received. Status: %, Error: %, Content: %', 
       response.status_code, 
       response.error_msg, 
       response.content;
     
     -- Check for errors
     IF response.error_msg IS NOT NULL THEN
       RETURN 'Cleanup function error: ' || response.error_msg;
     END IF;
     
     IF response.status_code != 200 THEN
       RETURN 'Cleanup function failed with status: ' || response.status_code;
     END IF;
     
     -- Clean up test data
     DELETE FROM users WHERE id = test_user_id;
     DELETE FROM auth.users WHERE id = test_user_id;
     
     -- If we got here, the cleanup was successful
     RETURN 'Success! Cleanup function completed successfully';

   EXCEPTION WHEN OTHERS THEN
     -- Clean up on error
     IF test_user_id IS NOT NULL THEN
       DELETE FROM users WHERE id = test_user_id;
       DELETE FROM auth.users WHERE id = test_user_id;
     END IF;
     RETURN 'Error: ' || SQLERRM;
   END;
   $$ LANGUAGE plpgsql;

   -- Run the test
   SELECT test_cleanup_function();
   ```

If the test fails, here's how to debug:

1. Check Edge Function logs:
   - Go to [Edge Functions](https://supabase.com/dashboard/project/_/functions)
   - Click on the `cleanup-expired-sessions` function
   - Go to the "Logs" tab
   - Look for any error messages

2. Common issues and fixes:
   - If you see "supabaseUrl is required" or similar errors:
     - The function is using the wrong environment variables
     - Try redeploying: `npm run deploy:cleanup`
   - If you see "permission denied":
     - Make sure you're using the correct ANON key
     - Check that all database extensions are enabled
   - If the session isn't deleted but no errors:
     - Check if `expires_at` is actually in the past
     - Verify the SQL query in the function matches your schema
   - If you see "Error: Quote command returned error"
       - You might've forgot to replace `<PROJECT_ID>` or `<ANON_KEY>`
       - Or maybe you kept `<>` (they shouldn't be apart of the string)

3. Still stuck?
   - Open a GitHub issue
   - Or contact me directly and I'll help [X - @mazewinther1](https://x.com/@mazewinther1) [Email](mailto:hi@mazecoding.com)

The function will:
1. Create a test user (in both auth and public schemas)
2. Create a test device
3. Create an expired session
4. Verify the session exists
5. Run the cleanup
6. Check if it worked
7. Clean up the test data
8. Tell you if it all worked!

## Good to know
- This whole process will get WAY simpler soon - Supabase is adding this right to their dashboard
- If setup fails, no big deal. Your database won't explode from old sessions
- The cleanup function is super simple - it just deletes sessions older than 365 days