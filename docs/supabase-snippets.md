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
  has_password boolean DEFAULT false,
  has_backup_codes boolean DEFAULT,
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

-- Step 4: Create trigger to update the "updated_at" column using the function we just created
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Create devices table**
```sql
-- Create devices table
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users NOT NULL,
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
CREATE POLICY "Users can create their own devices"
ON devices
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own devices"
ON devices
FOR SELECT
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

**Create device sessions table**
```sql
CREATE TABLE device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  is_trusted boolean DEFAULT false,
  needs_verification boolean DEFAULT false,
  confidence_score integer DEFAULT 0,
  aal text DEFAULT 'aal1' CHECK (aal IN ('aal1', 'aal2')),
  expires_at timestamp with time zone NOT NULL,
  -- When this device was verified via email code (for unknown device login)
  device_verified_at timestamp with time zone,
  -- When user last performed 2FA/basic verification for sensitive actions
  last_sensitive_verification_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 2: Enable Row-Level Security
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies

-- Allow users to view their own device sessions
CREATE POLICY "Allow users to view their own device sessions"
ON device_sessions
FOR SELECT
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

**Create verification codes table**
```sql
-- Create verification_codes table
CREATE TABLE verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_session_id uuid REFERENCES device_sessions(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  salt text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
-- Enable RLS
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;
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

**Create backup codes table**
```sql
-- Create backup_codes table
CREATE TABLE backup_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users NOT NULL,
    code_hash text NOT NULL,
    salt text NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS 
ALTER TABLE backup_codes ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_backup_codes_updated_at
BEFORE UPDATE ON backup_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_backup_codes_user_id ON backup_codes(user_id);
```

**Create account events table**
```sql
-- Create account_events table for activity tracking
CREATE TABLE account_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    device_session_id uuid REFERENCES device_sessions(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE account_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own events"
ON account_events
FOR SELECT
USING (user_id = auth.uid());

-- Create index for faster user event lookups
CREATE INDEX idx_account_events_user_id_created_at 
ON account_events(user_id, created_at DESC);
```