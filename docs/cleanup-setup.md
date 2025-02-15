# Setting up automatic database cleanup

## 1. Enable Database Extensions

1. Go to [Database Extensions](https://supabase.com/dashboard/project/_/database/extensions)
2. Enable the `pg_cron` extension it's not already

## 2. Run SQL queries

1. Go to [SQL Editor](https://supabase.com/dashboard/project/_/sql/new)
2. Run these queries:
    **Create cleanup function**
    ```sql
    CREATE OR REPLACE FUNCTION public.cleanup_expired_records()
    RETURNS void 
    LANGUAGE plpgsql 
    SECURITY DEFINER SET SEARCH_PATH=''
    AS $$
    BEGIN
      DELETE FROM public.verification_codes WHERE expires_at < NOW();
      DELETE FROM public.device_sessions WHERE expires_at < NOW();
    END;
    $$;
    ```

    **Schedule cleanup function**
    ```sql
    SELECT cron.schedule(
      'cleanup_database',         -- Job name
      '0 0 * * *',             -- Cron schedule for midnight
      $$ SELECT public.cleanup_expired_records(); $$
    );
    ```

## Good to know
- If setup fails, no big deal. Your database won't explode from old sessions