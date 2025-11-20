# Gmail API Integration Setup Guide

This branch (`feature/gmail-integration`) has been migrated from Microsoft Graph API to Gmail API to solve the refresh token problem with personal Microsoft accounts.

## What Changed

### Backend
- ✅ **authService.ts**: Rewritten to use Google OAuth 2.0 with `google-auth-library`
- ✅ **gmailService.ts**: New service replacing `graphService.ts`, using Gmail API
- ✅ **googleConfig.ts**: New config file replacing `msalConfig.ts`
- ✅ **Routes**: Updated `authRoutes.ts` and `emailRoutes.ts` to use new services
- ✅ **syncService.ts**: Updated to use `gmailService`
- ✅ **Packages**: Replaced `@azure/msal-node` and `@microsoft/microsoft-graph-client` with `googleapis` and `google-auth-library`

### Environment Variables
Updated `.env` file with Google OAuth credentials:
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

## Google Cloud Console Setup

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 2. Enable Gmail API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click "Enable"

### 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (for personal Gmail accounts)
3. Fill in app information:
   - App name: `Invoice Manager` (or your app name)
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/userinfo.email`
5. Add test users (your Gmail address)
6. Save and continue

### 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `Invoice Manager Web Client`
5. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for local development)
   - Add your production URL when deploying: `https://yourdomain.com/api/auth/callback`
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 5. Update .env File

Update `/backend/.env` with your credentials:

```bash
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
```

## Gmail Label Setup

Instead of Outlook folders, Gmail uses **Labels**. You need to create a label called "faktury" (or whatever you use for invoices):

1. Open Gmail
2. Click the **Settings gear** → **See all settings**
3. Go to **Labels** tab
4. Scroll to "Labels" section and click **Create new label**
5. Name it: `faktury`
6. Click **Create**

Now move your invoice emails to this label, or create a filter to automatically label incoming invoices.

## Testing the Integration

### 1. Start the Development Server

```bash
cd backend
yarn dev
```

```bash
cd frontend
yarn dev
```

### 2. Test Authentication Flow

1. Open http://localhost:5173
2. Click "Connect Gmail Account" button
3. You should be redirected to Google's OAuth consent screen
4. Sign in with your Gmail account
5. Grant the requested permissions
6. You should be redirected back to the app

### 3. Verify Refresh Token

Check the backend logs for:
```
=== Google OAuth Token Response ===
Has access token: true
Has refresh token: true ✅ This should be true!
Refresh token value: [some long string]
====================================
```

**Key Difference**: Unlike Microsoft personal accounts, Google OAuth WILL return a refresh token on first consent, allowing background jobs to work properly!

### 4. Test Email Fetching

1. After authentication, you should see emails from your "faktury" label
2. Click on an email to view attachments
3. Click on a PDF attachment to extract invoice data

### 5. Test Background Jobs

The background job should now work because Google returns refresh tokens:

1. Wait for the automatic job to run (or trigger manually via UI)
2. Check backend logs for successful token refresh:
```
=== Google OAuth Refresh Token Response ===
Has access token: true
Has refresh token: true
==========================================
```

## Key Benefits Over Microsoft OAuth

1. ✅ **Refresh tokens work** for personal Gmail accounts
2. ✅ **Background jobs can run** indefinitely with token refresh
3. ✅ **No 1-hour limitation** - app continues working without re-authentication
4. ✅ **Better scope granularity** - Gmail API has more specific permissions
5. ✅ **More reliable** - Google's OAuth implementation is more mature

## Troubleshooting

### "Error 403: access_denied"
- Make sure you added your Gmail as a test user in OAuth consent screen
- Verify the app is in "Testing" mode (not "Production" yet)

### "redirect_uri_mismatch"
- Check that the redirect URI in Google Console matches exactly: `http://localhost:3000/api/auth/callback`
- No trailing slash, exact protocol (http/https)

### "Label 'faktury' not found"
- Create the label in Gmail settings
- The label name is case-insensitive but must match

### No refresh token returned
- Make sure you include `access_type: 'offline'` in OAuth request (already configured)
- Make sure `prompt: 'consent'` is set (already configured)
- Try revoking app access at https://myaccount.google.com/permissions and re-authenticating

## Next Steps

1. Set up Google Cloud Console project
2. Create OAuth credentials
3. Update `.env` file
4. Create "faktury" label in Gmail
5. Test the authentication flow
6. Verify refresh tokens are working
7. Deploy to production (update redirect URI in Google Console)

## Production Deployment

When deploying to production:

1. Update redirect URI in Google Console:
   - Add: `https://yourdomain.com/api/auth/callback`
2. Update `.env` on production server with production values
3. Optionally move OAuth consent screen from "Testing" to "Production" mode
4. Update `FRONTEND_URL` and `REDIRECT_URI` environment variables

---

**Migration completed!** 🎉

The app is now using Gmail API instead of Microsoft Graph API, which means:
- ✅ Refresh tokens work properly
- ✅ Background jobs can run indefinitely
- ✅ No more session expiration issues
