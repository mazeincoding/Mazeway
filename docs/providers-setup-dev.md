## Setting up social providers for development

### Google

1. Configure Google Auth
    - Go to [Google Cloud Console](https://console.cloud.google.com/)
    - Create a new project in the top left corner
    - Go to APIs and services -> OAuth consent screen ([direct link](https://console.cloud.google.com/auth/overview))
    - Click "Get started" and enter an app name in the "App name" field (eg: auth-starter)
    - Choose your email for "User support email"
    - For the Audience, select External
    - Enter an email for "Contact Information"
2. Update Auth Branding
    - In the left sidebar, go to "Branding" ([link](https://console.cloud.google.com/auth/branding))
    - Scroll down to "Authorized domains" and click the "ADD DOMAIN" button. Enter your Supabase project URL here. We got this in the early steps. It should look like `<PROJECT_ID>.supabase.co`.

    > Note: The URL shouldn't include the `https://` part

    > If you went in production and you followed the two-project based approach, add your production project too. If you're just in development now, just worry about development.
3. Create OAuth client (previously OAuth credentials)
    - Go to: [Google OAuth Clients](https://console.cloud.google.com/auth/clients)
    - Click "create client"
    - For "Application type", choose "Web application".
    - Under "Authorized JavaScript origins", add your site URL which is `http://localhost:3000`

    > If you went in production or you have a custom domain you want to use, you can add that too. If you're just in development now or you don't have a domain, just worry about development.

    - Under "Authorized redirect URLs", enter the "callback URL" from the Supabase dashboard. To get it, follow these steps:
        1. Go to [Supabase Auth Providers](https://supabase.com/dashboard/project/_/auth/providers)
        2. Scroll down until you see "Google" and expand it
        3. You'll find a field labeled "Callback URL (for OAuth)".

        > If you went in production and you followed the two-project based approach, do the same thing for your Supabase production project. If you're just in development now, just worry about development.
        
    - In the Google console, click "create" and you will be shown your "Client ID" and "Client secret"
    - Copy those, go back to Supabase and paste those. Then click "Save"
    
If you have trouble following along, you can check out Supabase's [official docs](https://supabase.com/docs/guides/auth/social-login/auth-google)