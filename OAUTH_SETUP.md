# OAuth2 Setup Instructions

## Overview

The Stream Deck SmartThings plugin uses OAuth2 with PKCE for authentication. This requires:
1. A hosted callback page to capture the authorization code
2. Configuration in SmartThings Developer Workspace
3. User-provided Client ID and Secret

## For Plugin Users

### Prerequisites

You need to create a SmartThings Developer account and register an OAuth client:

1. Go to https://smartthings.developer.samsung.com/workspace
2. Create a project (or use existing)
3. Navigate to **"Register App"** → **"OAuth Client"**
4. Configure:
   - **App Name**: Your choice (e.g., "Stream Deck Integration")
   - **Redirect URIs**: Add `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html`
   - **Scopes**: Select:
     - `r:devices:*` (Read devices)
     - `x:devices:*` (Execute device commands)
     - `r:scenes:*` (Read scenes)
     - `x:scenes:*` (Execute scenes)
5. Save and copy your **Client ID** and **Client Secret**

### Authorization Flow

1. **In Stream Deck**:
   - Add a SmartThings button
   - Enter your Client ID and Client Secret
   - Click "Open Authorization Page"

2. **In Browser**:
   - Log in to SmartThings
   - Authorize the app
   - You'll be redirected to the callback page
   - Your authorization code will be displayed

3. **Back in Stream Deck**:
   - Copy the code from the webpage
   - Paste into "Authorization Code" field
   - Click "Complete Authorization"
   - Select your device/scene

## For Plugin Developers

### Current Callback URL

The plugin currently uses: `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html`

This is hosted from the separate repo at: `/Users/thibaut.sabot/Projects/streamdeck-smartthings-oauth/`

### Deploying Your Own Callback Page

If you want to host your own callback page:

1. **Deploy to Vercel**:
   ```bash
   cd /Users/thibaut.sabot/Projects/streamdeck-smartthings-oauth
   npm install -g vercel  # if not installed
   vercel --prod
   ```

2. **Update Plugin Code**:
   Edit [src/utils/oauth-client.ts](src/utils/oauth-client.ts):
   ```typescript
   redirectUri: 'https://YOUR-VERCEL-URL.vercel.app/oauth-callback.html',
   ```

3. **Update SmartThings**:
   - Add your new URL to SmartThings Developer Workspace redirect URIs
   - Update plugin documentation with new URL

4. **Rebuild Plugin**:
   ```bash
   npm run build
   ```

### Testing

Test the callback page directly:
```
https://YOUR-URL.vercel.app/oauth-callback.html?code=test123
```

You should see the test code displayed with a copy button.

### How It Works

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Stream     │         │  SmartThings │         │   Vercel    │
│  Deck       │         │    OAuth     │         │  Callback   │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │ 1. Get auth URL       │                        │
       │ (with PKCE)           │                        │
       │───────────────────────>                        │
       │                       │                        │
       │ 2. Open browser       │                        │
       │──────────────────────>│                        │
       │                       │                        │
       │                  3. User logs in               │
       │                  & authorizes                  │
       │                       │                        │
       │                       │ 4. Redirect with code  │
       │                       │───────────────────────>│
       │                       │                        │
       │                       │    5. Display code     │
       │                       │    (user copies it)    │
       │                       │                        │
       │ 6. User pastes code   │                        │
       │<──────────────────────────────────────────────│
       │                       │                        │
       │ 7. Exchange code      │                        │
       │    for tokens         │                        │
       │    (with PKCE)        │                        │
       │───────────────────────>                        │
       │                       │                        │
       │ 8. Access token       │                        │
       │<──────────────────────│                        │
       │                       │                        │
```

### Security Features

- **PKCE (Proof Key for Code Exchange)**: Protects against authorization code interception
- **State Parameter**: Prevents CSRF attacks
- **HTTPS Required**: All OAuth endpoints use HTTPS
- **Token Expiry**: Access tokens expire and are refreshed automatically
- **No Server-Side Storage**: The callback page runs entirely client-side

### Troubleshooting

**Button doesn't open browser**:
- The plugin uses Stream Deck's `$SD.api.openUrl()` API
- Check console logs for errors
- Verify the plugin is properly built

**"Invalid redirect_uri" error**:
- Verify the redirect URI in code matches SmartThings Developer Workspace exactly
- Must include full URL with `https://` and `/oauth-callback.html`
- No trailing slash

**503 error on callback page**:
- This shouldn't happen with the Vercel deployment
- If using a different host, ensure it's publicly accessible
- Check Vercel deployment logs

**Code exchange fails**:
- Codes expire after a few minutes
- Ensure you're copying the entire code (no extra spaces)
- Verify Client ID and Secret are correct
- Check SmartThings API status

## Files Modified

- [src/base-property-inspector.ts](src/base-property-inspector.ts) - Fixed button to use Stream Deck API
- [src/utils/oauth-client.ts](src/utils/oauth-client.ts) - Updated redirect URI

## Related Repositories

- OAuth Callback Page: `/Users/thibaut.sabot/Projects/streamdeck-smartthings-oauth/`
  - Deployed at: https://streamdeck-smartthings-oauth.vercel.app
