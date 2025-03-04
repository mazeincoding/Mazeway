**Confirm signup**
```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Confirm your signup</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, 
Cantarell, 'Helvetica     Neue', sans-serif; margin: 0; padding: 0;">
  <div class="container" style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
    <!-- Header with Logo -->
    <div>
      <img src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038.png" alt="Logo" 
style="margin-bottom: 12px; max-width:     150px; width: 100%; height: auto; display: block;">
    </div>
    
    <!-- Main Heading -->
    <h1 style="font-size: 24px; font-weight: 600; color: #202124; text-align: left; margin: 30px 0 20px;">Confirm Your Signup</h1>
    
    <!-- Main Content -->
    <div style="margin-bottom: 16px;">
      <p style="font-size: 16px; color: #5f6368; margin: 0 0 16px;">
        Thank you for signing up. Please confirm your email address to complete your registration.
      </p>
    </div>
    
    <!-- Action Button Section -->
    <div style="background-color: #ffffff; padding: 20px 0; text-align: left; margin-bottom: 20px;">
      <a href="{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup" style="background-color: #000000; color: 
white; padding: 12px     24px; text-decoration: none; border-radius: 4px; font-weight: 500; display: inline-block; 
font-size: 16px;">Confirm Email</a>
    </div>
    
    <!-- Footer Text -->
    <p style="font-size: 14px; color: #5f6368; margin-top: 20px; text-align: left;">
      If you did not create an account, please ignore this email.
    </p>
  </div>
</body>
</html>
```
    
**Change Email Address**
```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Confirm Change of Email</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, 
Cantarell, 'Helvetica     Neue', sans-serif; margin: 0; padding: 0;">
  <div class="container" style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
    <!-- Header with Logo -->
    <div>
      <img src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038.png" alt="Logo" 
style="margin-bottom: 12px; max-width:     150px; width: 100%; height: auto; display: block;">
    </div>
    
    <!-- Main Heading -->
    <h1 style="font-size: 24px; font-weight: 600; color: #202124; text-align: left; margin: 30px 0 20px;">Confirm Change of 
Email</h1>
    
    <!-- Main Content -->
    <div style="margin-bottom: 16px;">
      <p style="font-size: 16px; color: #5f6368; margin: 0 0 16px;">
        We received a request to change your email address from {{ .Email }} to {{ .NewEmail }}. Please confirm this change by 
clicking the button below.
      </p>
    </div>
    
    <!-- Action Button Section -->
    <div style="background-color: #ffffff; padding: 20px 0; text-align: left; margin-bottom: 20px;">
      <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change&next=/account" style="background-color: 
#000000; color: white;     padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: 500; display: 
inline-block; font-size: 16px;">Confirm Email Change</a>
    </div>
    
    <!-- Footer Text -->
    <p style="font-size: 14px; color: #5f6368; margin-top: 20px; text-align: left;">
      If you did not request this change, please secure your account immediately by changing your password.
    </p>
  </div>
</body>
</html>
```
    
**Reset Password**
```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <title>Reset Your Password</title>
  <style>
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, 
Cantarell, 'Helvetica     Neue', sans-serif; margin: 0; padding: 0;">
  <div class="container" style="padding: 40px 20px; max-width: 600px; margin: 0 auto;">
    <!-- Header with Logo -->
    <div>
      <img src="https://rqsfebcljeizuojtkabi.supabase.co/storage/v1/object/public/logo/Frame%2038.png" alt="Logo" 
style="margin-bottom: 12px; max-width:     150px; width: 100%; height: auto; display: block;">
    </div>
    
    <!-- Main Heading -->
    <h1 style="font-size: 24px; font-weight: 600; color: #202124; text-align: left; margin: 30px 0 20px;">Reset Your Password</h1>
    
    <!-- Main Content -->
    <div style="margin-bottom: 16px;">
      <p style="font-size: 16px; color: #5f6368; margin: 0 0 16px;">
        We received a request to reset your password. Click the button below to create a new password.
      </p>
    </div>
    
    <!-- Action Button Section -->
    <div style="background-color: #ffffff; padding: 20px 0; text-align: left; margin-bottom: 20px;">
      <a href="{{ .SiteURL }}/api/auth/callback?type=recovery&token_hash={{ .TokenHash }}" style="background-color: #000000; 
color: white; padding: 12px     24px; text-decoration: none; border-radius: 4px; font-weight: 500; display: inline-block; 
font-size: 16px;">Reset Password</a>
    </div>
    
    <!-- Footer Text -->
    <p style="font-size: 14px; color: #5f6368; margin-top: 20px; text-align: left;">
      If you did not request a password reset, please ignore this email or contact support if you have concerns.
    </p>
  </div>
</body>
</html>
```

> [!NOTE]
> You can customize these email templates depending on your needs, like the primary color or other stuff.
>
> Don't stress too much about this in development. This README has a production checklist that covers this already so you won't forget.
>
> Same deal with the logo. Production checklist got you covered for when you actually need it.