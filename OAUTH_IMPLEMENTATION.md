# OAuth 2.0 Implementation Guide

This document describes the OAuth 2.0 implementation in the SmartThings StreamDeck plugin.

## Overview

The plugin uses **OAuth 2.0** as the sole authentication method - secure, token-based authentication with automatic refresh.

## Architecture

### Key Components

#### 1. OAuth Service (`src/utils/oauth-service.ts`)
Handles OAuth 2.0 flow operations:
- Authorization URL generation
- Token exchange (authorization code → access/refresh tokens)
- Token refresh
- Token expiration checking

#### 2. OAuth Callback Server (`src/utils/oauth-callback-server.ts`)
Local HTTP server that:
- Listens on `localhost:8888` for OAuth callbacks
- Handles the redirect from SmartThings authorization
- Validates state parameter (CSRF protection)
- Returns user-friendly HTML pages for success/error states

#### 3. OAuth Manager (`src/utils/oauth-manager.ts`)
High-level orchestrator that:
- Coordinates the complete OAuth flow
- Opens browser for authorization
- Manages callback server lifecycle
- Handles token refresh

#### 4. Property Inspector Updates
- **Base Property Inspector** (`src/base-property-inspector.ts`)
  - Dual UI for OAuth and PAT
  - OAuth button handler
  - Automatic token fetching after authorization
- **HTML Files** - All property inspectors now have:
  - Toggle between OAuth and PAT modes
  - OAuth credential inputs (Client ID, Client Secret)
  - Authentication status display
  - Authorize button

#### 5. Action Classes Updates
- **Base Action** (`src/actions/base-action.ts`)
  - New `getAccessToken()` method
  - Automatic token refresh when expired
  - Seamless support for both OAuth and PAT
- **All Device/Scene Actions**
  - Updated to use `getAccessToken()` instead of direct token access
  - No breaking changes to action logic

### Data Flow

#### Initial Setup (OAuth)
```
User enters Client ID/Secret
    ↓
User clicks "Authorize"
    ↓
OAuthManager.startAuthorizationFlow()
    ↓
Callback server starts on localhost:8888
    ↓
Browser opens SmartThings authorization page
    ↓
User authorizes the app
    ↓
SmartThings redirects to localhost:8888/callback?code=...
    ↓
Server receives code, validates state
    ↓
Exchange code for tokens (access + refresh)
    ↓
Save tokens to global settings
    ↓
Fetch devices/scenes list
```

#### Action Execution with Token Refresh
```
User presses StreamDeck button
    ↓
Action.getAccessToken()
    ↓
Check if OAuth tokens exist
    ↓
Is token expired? (< 5 min remaining)
    ↓ Yes
Refresh token using refresh_token
    ↓
Save new tokens to global settings
    ↓
Return fresh access token
    ↓
Use token to call SmartThings API
```

## Security Features

### 1. CSRF Protection
- State parameter generated for each OAuth flow
- Server validates state matches before accepting callback

### 2. Token Storage
- Tokens stored in StreamDeck's secure settings
- Never exposed in logs or UI (except masked)
- Client Secret stored securely

### 3. Automatic Token Refresh
- Tokens checked before each API call
- Refreshed automatically 5 minutes before expiry
- Prevents 401 errors and improves UX

### 4. Timeout Protection
- Callback server times out after 5 minutes
- Prevents hanging connections

## Configuration

### OAuth Application Setup (SmartThings)

Users need to create a SmartThings OAuth application:

1. Visit [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)
2. Create new app with:
   - **App Type**: Automation for the SmartThings App
   - **OAuth Client**: Confidential
   - **Redirect URI**: `http://localhost:8888/callback`
   - **Scopes**: 
     - `r:devices:*` (Read devices)
     - `x:devices:*` (Execute devices)
     - `r:scenes:*` (Read scenes)
     - `x:scenes:*` (Execute scenes)

3. Copy Client ID and Client Secret
4. Enter in plugin configuration

### Settings Storage

```typescript
interface GlobalSettingsInterface {
  oauthTokens: {
    accessToken: string
    refreshToken: string
    expiresAt: number  // Unix timestamp
    tokenType: string
  }
  oauthClientId: string
  oauthClientSecret: string
}
```

## Setup for Users

### First-Time Setup
- OAuth-only, no legacy authentication
- Clear UI guidance for creating SmartThings OAuth app
- Simple 4-step process to get authenticated

## Testing

### Unit Tests
All tests updated to use OAuth:
- Test helper `createMockGlobalSettings()` provides valid OAuth structure
- Actions use `getAccessToken()` which handles OAuth refresh
- OAuth logic isolated in service/manager classes for easy mocking

### Manual Testing Checklist
- [ ] OAuth flow completes successfully
- [ ] Devices/scenes fetch after OAuth
- [ ] Token refresh works automatically
- [ ] PAT mode still works
- [ ] Toggle between modes works
- [ ] Error handling (denied authorization, timeout, etc.)

## Future Improvements

1. **Token Encryption**
   - Encrypt tokens at rest in settings
   - Use OS keychain integration

2. **Multi-Account Support**
   - Allow multiple SmartThings accounts
   - Per-action account selection

3. **Scope Optimization**
   - Request minimum required scopes per action type
   - Dynamic scope requests

4. **Token Revocation**
   - Add "Sign Out" button
   - Revoke token on SmartThings side

5. **Better Error Messages**
   - Specific guidance for common OAuth errors
   - Link to troubleshooting guide

## Troubleshooting

### "OAuth callback timeout"
- Check firewall isn't blocking localhost:8888
- Try again (server cleans up automatically)

### "Token refresh failed"
- Refresh token may have been revoked
- User needs to re-authorize

### "State parameter mismatch"
- Possible CSRF attack or browser issue
- Clear browser cache and try again

## References

- [SmartThings API Documentation](https://smartthings.developer.samsung.com/docs)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [OAuth 2.0 for Native Apps (BCP 212)](https://tools.ietf.org/html/rfc8252)
