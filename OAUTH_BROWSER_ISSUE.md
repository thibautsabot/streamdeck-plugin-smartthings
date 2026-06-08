# OAuth Implementation Issue - Browser Environment

## Problem

The current OAuth implementation uses a Node.js HTTP server (`oauth-callback-server.ts`) to handle the OAuth callback. However, StreamDeck plugins run entirely in a **browser context** (everything is browserified), so Node.js modules like `http` are not available.

## Current Architecture (Won't Work)
```
Property Inspector (Browser) 
  → OAuthManager 
    → OAuthCallbackServer (requires Node.js http module) ❌
```

## Solutions

### Option 1: Manual Code Entry (Recommended for now)
**Pros:**
- Simple to implement
- Works in pure browser environment
- No external dependencies

**Cons:**
- Slightly less user-friendly (copy/paste required)

**Flow:**
1. Open authorization URL in browser
2. User authorizes
3. SmartThings redirects to `http://localhost:8888/callback?code=XXX`
4. User manually copies the `code` from URL
5. User pastes code into property inspector
6. Plugin exchanges code for tokens

### Option 2: Use a Hosted Callback Page
**Pros:**
- Better UX - no copy/paste
- Standard OAuth flow

**Cons:**
- Requires hosting a callback page
- Security concerns with hosted redirect

### Option 3: PKCE Flow (Proof Key for Code Exchange)
**Pros:**
- Secure for public clients
- No server needed
- Works client-side

**Cons:**
- More complex to implement
- Need to verify SmartThings supports PKCE

### Option 4: Check if Plugin (not PI) can run Node.js
**Need to investigate:**
- Can the main plugin.html/js run Node.js code?
- Can we move OAuth server to the plugin side?

## Recommendation

For **v1.0**, implement **Option 1 (Manual Code Entry)** since it's simple and works.

For **future versions**, investigate **Option 3 (PKCE)** as it's the modern standard for browser-based OAuth.

## Action Items

- [ ] Remove `oauth-callback-server.ts` (requires Node.js)
- [ ] Update `oauth-manager.ts` to use manual code entry
- [ ] Update property inspector UI to show code input field
- [ ] Update README with manual code entry instructions
