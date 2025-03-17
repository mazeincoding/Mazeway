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
    DECLARE
      export_ids uuid[];
    BEGIN
      -- Clean up expired verification codes
      DELETE FROM public.verification_codes WHERE expires_at < NOW();
      
      -- Clean up expired device sessions
      DELETE FROM public.device_sessions WHERE expires_at < NOW();
      
      -- Get IDs of completed exports older than 24 hours
      SELECT ARRAY_AGG(id) INTO export_ids
      FROM public.data_export_requests 
      WHERE 
        (status = 'completed' AND completed_at < NOW() - INTERVAL '24 hours')
        OR 
        (status = 'pending' AND created_at < NOW() - INTERVAL '24 hours')
        OR
        (status = 'failed' AND updated_at < NOW() - INTERVAL '24 hours');
      
      -- Delete the export files from storage
      -- Note: This requires the storage.objects table to exist
      IF export_ids IS NOT NULL THEN
        DELETE FROM storage.objects 
        WHERE bucket_id = 'exports' 
        AND path LIKE ANY (
          SELECT 'exports/' || id::text || '%'
          FROM unnest(export_ids) AS id
        );
        
        -- Clean up the export requests
        DELETE FROM public.data_export_requests 
        WHERE id = ANY(export_ids);
      END IF;
    END;
    $$;
    ```

    **Schedule cleanup function**
    ```sql
    SELECT cron.schedule(
      'cleanup_database',         -- Job name
      '0 0 * * *',             -- Cron schedule for midnight
      $$
      SELECT cleanup_expired_records();
      $$
    );
    ```

## What gets cleaned up?

The cleanup function handles:

1. **Verification codes**: Removes expired verification codes
2. **Device sessions**: Removes expired device sessions
3. **Data exports**: Cleans up:
   - Completed exports older than 24 hours
   - Pending exports that haven't completed in 24 hours (likely stuck)
   - Failed exports older than 24 hours
   - Associated export files from Supabase Storage

The cleanup runs automatically at midnight every day.