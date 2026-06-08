# PKCE (Proof Key for Code Exchange) - Complete Explanation

## What is PKCE?

PKCE (pronounced "pixy") is an OAuth 2.0 security extension (RFC 7636) that makes the authorization code flow secure for **public clients** (apps that can't keep secrets, like browser apps, mobile apps, desktop apps).

## The Core Problem

### Traditional OAuth Flow (Doesn't Work for Browser Apps)
```
┌─────────────┐                                    ┌──────────────┐
│   Browser   │                                    │   Server     │
│    App      │                                    │  (SmartThings)│
└──────┬──────┘                                    └──────┬───────┘
       │                                                  │
       │ 1. Authorization Request                        │
       │    + client_id                                   │
       │    + client_secret ❌ (exposed in browser!)     │
       ├─────────────────────────────────────────────────>│
       │                                                  │
       │ 2. Redirect back with code                      │
       │<─────────────────────────────────────────────────┤
       │                                                  │
       │ 3. Exchange code for token                      │
       │    + code                                        │
       │    + client_secret ❌ (exposed in browser!)     │
       ├─────────────────────────────────────────────────>│
       │                                                  │
       │ 4. Returns access_token                         │
       │<─────────────────────────────────────────────────┤
```

**Problem:** Client secret is in the browser JavaScript code!
- Anyone can view source and steal it
- Can't keep secrets in public clients

## PKCE Solution

### How PKCE Works (Step by Step)

```
┌─────────────┐                                    ┌──────────────┐
│   Browser   │                                    │   Server     │
│    App      │                                    │  (SmartThings)│
└──────┬──────┘                                    └──────┬───────┘
       │                                                  │
       │ STEP 1: Generate Random Strings                 │
       │ ─────────────────────────────────               │
       │ code_verifier = random(43-128 chars)            │
       │   "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk" │
       │                                                  │
       │ code_challenge = SHA256(code_verifier)          │
       │   "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" │
       │                                                  │
       │                                                  │
       │ STEP 2: Authorization Request                   │
       │ ──────────────────────────────                  │
       │ + client_id (public, OK to share)               │
       │ + code_challenge (hash, can't reverse it)       │
       │ + code_challenge_method: S256                   │
       ├─────────────────────────────────────────────────>│
       │                                                  │ Stores:
       │                                                  │ - code_challenge
       │                                                  │ - generates auth code
       │                                                  │
       │ STEP 3: User Authorizes                         │
       │<─────────────────────────────────────────────────┤
       │ Redirect: ?code=AUTH_CODE                       │
       │                                                  │
       │                                                  │
       │ STEP 4: Token Exchange                          │
       │ ────────────────────                            │
       │ + code                                           │
       │ + code_verifier (original, unhashed) ✓          │
       │ + client_id                                      │
       ├─────────────────────────────────────────────────>│
       │                                                  │ Verifies:
       │                                                  │ SHA256(code_verifier)
       │                                                  │   == stored code_challenge?
       │                                                  │
       │ STEP 5: Success!                                │
       │<─────────────────────────────────────────────────┤
       │ Returns access_token + refresh_token            │
```

### Key Security Properties

**1. No Client Secret Needed**
- Only need public Client ID
- Safe to expose in browser code

**2. Code Verifier is Private**
- Generated fresh for each OAuth flow
- Lives only in browser memory (not in URL)
- Never sent in authorization request
- Only sent when exchanging code

**3. Code Challenge is Public**
- Hash of code verifier (SHA-256)
- Safe to send in URL
- Can't reverse hash to get verifier

**4. Protects Against Code Interception**
- Attacker steals code? Useless without verifier
- Can't exchange code without original verifier
- Verifier never travels through browser URL

## Technical Details

### Code Verifier Requirements
- Random string: 43-128 characters
- Allowed characters: `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, `~`
- Cryptographically random (not predictable)

### Code Challenge Generation
```typescript
// 1. Generate random verifier
const verifier = generateRandomString(128)

// 2. Hash it with SHA-256
const challenge = base64UrlEncode(sha256(verifier))

// 3. Send challenge in auth request, keep verifier secret
```

### Example Values

**code_verifier (kept secret):**
```
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

**code_challenge (sent in URL):**
```
E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

## Why PKCE for StreamDeck Plugin?

### Our Situation
- ✅ Browser environment (property inspector)
- ✅ Can't use Node.js HTTP server
- ✅ Can't keep Client Secret secure
- ✅ Need OAuth authorization code flow

### PKCE Benefits
1. **No Server Needed**: Direct browser redirect, no callback server
2. **No Secrets**: Only public Client ID in code
3. **Secure**: Code verifier proves legitimate client
4. **Standard**: RFC 7636, widely supported
5. **Simple**: Less code than callback server approach

## Attack Scenarios PKCE Prevents

### Scenario 1: Code Interception
**Without PKCE:**
```
Attacker intercepts code → Uses code + stolen client_secret → Gets tokens ❌
```

**With PKCE:**
```
Attacker intercepts code → Can't use it without code_verifier ✓
```

### Scenario 2: Malicious App
**Without PKCE:**
```
Fake app uses stolen client_id + client_secret → Impersonates real app ❌
```

**With PKCE:**
```
Fake app can't generate valid code_verifier for intercepted code ✓
```

## References
- [RFC 7636: PKCE for OAuth Public Clients](https://tools.ietf.org/html/rfc7636)
- [OAuth 2.0 for Browser-Based Apps (Best Practices)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)
