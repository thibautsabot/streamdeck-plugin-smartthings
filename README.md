# SmartThings Plugin for Stream Deck

Control your SmartThings devices and scenes directly from your Stream Deck with secure OAuth 2.0 authentication.

![Screenshot showing SmartThings actions in Stream Deck](https://user-images.githubusercontent.com/9283289/112819301-bd3e6d80-9084-11eb-86bd-a6e015268c9f.png)

## Features

- 🔒 **Secure OAuth 2.0 authentication** with PKCE (Proof Key for Code Exchange)
- 🔄 **Automatic token refresh** - no manual re-authentication needed
- 💾 **Local token storage** - your credentials never leave your machine
- ⚡ **Direct API communication** - fast and reliable control
- 🎛️ **Multiple device types** - lights, switches, garage doors, and scenes

---

## Installation & Setup

### Download and Install

1. Download the latest release from [GitHub Releases](https://github.com/thibautsabot/streamdeck-plugin-smartthings/releases)
2. Open `com.thibautsabot.streamdeck.smartthings.streamDeckPlugin`
3. Stream Deck will install the plugin automatically

### Create a SmartThings OAuth App

Before you can use the plugin, you need to create an OAuth application in the SmartThings Developer Workspace:

1. Go to [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)
2. Sign in with your Samsung/SmartThings account
3. Click **"Register App"** → **"OAuth Client"**
4. Configure your app:
   - **App Name**: Your choice (e.g., "Stream Deck Integration")
   - **App Type**: **Automation for the SmartThings App**
   - **OAuth Client Type**: **Confidential**
   - **Redirect URI**: `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html`
   - **Scopes**: Select at least:
     - `r:devices:*` (Read devices)
     - `x:devices:*` (Execute device commands)
     - `r:scenes:*` (Read scenes)
     - `x:scenes:*` (Execute scenes)
5. Save and copy your **Client ID** and **Client Secret**

### Authorize the Plugin

1. **Add an action** to your Stream Deck (Light, Switch, Garage Door, or Scene)
2. **Enter credentials**:
   - Paste your **Client ID**
   - Paste your **Client Secret**
3. **Click "Open Authorization Page"**
   - Your browser will open to the SmartThings authorization page
   - Sign in and authorize the plugin
   - You'll be redirected to a page showing your authorization code
4. **Copy the code** from the webpage
5. **Back in Stream Deck**:
   - Paste the code into the "Authorization Code" field
   - Click "Complete Authorization"
   - You should see "✓ Authenticated"
6. **Select your device or scene** from the dropdown menu

That's it! Your action is now ready to use.

### How OAuth Works

The plugin uses **PKCE (Proof Key for Code Exchange)**, a secure OAuth 2.0 flow designed for browser-based apps:

1. Plugin generates a random secret (code verifier) and its hash (code challenge)
2. Opens SmartThings authorization with the hash (not the secret)
3. You authorize the app
4. SmartThings returns an authorization code
5. Plugin exchanges the code + original secret for tokens
6. Tokens are stored locally and refreshed automatically

**Why PKCE?** It's secure without requiring a client secret exposed in your browser, and it prevents authorization code interception attacks.

---

## For Developers & Contributors

### Project Overview

This plugin is built with TypeScript and uses the [SmartThings API](https://smartthings.developer.samsung.com/docs) for device control. It was created from [typescript-streamdeck-boilerplate](https://github.com/thibautsabot/typescript-streamdeck-boilerplate/).

**Current capabilities:**
- Control any SmartThings "switch" devices (lights, switches, outlets, etc.)
- Execute SmartThings scenes
- Garage door control
- More device types possible (but not tested due to lack of hardware)

### Getting Started

#### Prerequisites

- Node.js (v18 or later recommended)
- npm or yarn
- Stream Deck software

#### Installation

```bash
# Clone the repository
git clone https://github.com/thibautsabot/streamdeck-plugin-smartthings.git
cd streamdeck-plugin-smartthings

# Install dependencies
npm install

# Build the plugin
npm run build
```

#### Development Workflow

```bash
# Watch mode (rebuilds on file changes)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint
```

The built plugin will be in `com.thibautsabot.streamdeck.smartthings.sdPlugin/`. You can symlink this to your Stream Deck plugins folder:

**macOS:**
```bash
ln -s $(pwd)/com.thibautsabot.streamdeck.smartthings.sdPlugin \
  ~/Library/Application\ Support/com.elgato.StreamDeck/Plugins/
```

**Windows:**
```cmd
mklink /D "%appdata%\Elgato\StreamDeck\Plugins\com.thibautsabot.streamdeck.smartthings.sdPlugin" "path\to\com.thibautsabot.streamdeck.smartthings.sdPlugin"
```

### Project Architecture

#### Directory Structure

```
src/
├── actions/          # Action implementations
│   ├── base-action.ts         # Base class for all actions
│   ├── base-device.ts         # Base for device actions
│   ├── light.ts               # Light control
│   ├── switch.ts              # Switch control
│   ├── garage-door.ts         # Garage door control
│   └── scene.ts               # Scene execution
├── utils/
│   ├── oauth-client.ts        # OAuth 2.0 + PKCE implementation
│   └── smartthings-client.ts  # SmartThings API wrapper
├── base-property-inspector.ts # Shared UI logic
└── plugin.ts                  # Plugin entry point
```

#### Key Components

**OAuth Client** ([src/utils/oauth-client.ts](src/utils/oauth-client.ts))
- Implements OAuth 2.0 with PKCE
- Handles authorization URL generation
- Exchanges authorization codes for tokens
- Manages token refresh
- Uses hosted callback page at `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html`

**SmartThings Client** ([src/utils/smartthings-client.ts](src/utils/smartthings-client.ts))
- Wrapper around SmartThings REST API
- Device listing and control
- Scene execution
- Automatic token refresh integration

**Base Action** ([src/actions/base-action.ts](src/actions/base-action.ts))
- Common functionality for all actions
- Token management (`getAccessToken()` with auto-refresh)
- Settings persistence
- Status updates

**Property Inspectors** (HTML files in each action folder)
- OAuth credential input
- Device/scene selection dropdowns
- Authentication status display
- Authorization flow UI

### OAuth Flow Details

The plugin uses a hybrid OAuth flow due to Stream Deck's browser-based environment:

```
┌──────────────┐         ┌──────────────┐         ┌─────────────┐
│  Stream Deck │         │  SmartThings │         │   Vercel    │
│  (Browser)   │         │    OAuth     │         │  Callback   │
└──────┬───────┘         └──────┬───────┘         └──────┬──────┘
       │                        │                        │
       │ 1. Generate PKCE       │                        │
       │    code_verifier       │                        │
       │    code_challenge      │                        │
       │                        │                        │
       │ 2. Open auth URL       │                        │
       │    + code_challenge    │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │                   3. User authorizes            │
       │                        │                        │
       │                        │ 4. Redirect with code  │
       │                        │───────────────────────>│
       │                        │                        │
       │                        │    5. Display code     │
       │                        │    (user copies)       │
       │                        │                        │
       │ 6. User pastes code    │                        │
       │<───────────────────────────────────────────────│
       │                        │                        │
       │ 7. Exchange code       │                        │
       │    + code_verifier     │                        │
       │───────────────────────>│                        │
       │                        │                        │
       │ 8. Tokens returned     │                        │
       │<───────────────────────│                        │
```

**Why a hosted callback?** Stream Deck property inspectors run in a browser context without access to Node.js HTTP servers. The hosted callback page simply displays the authorization code for the user to copy back.

**Security features:**
- PKCE prevents authorization code interception
- State parameter prevents CSRF attacks
- Tokens stored in Stream Deck's encrypted settings
- Automatic refresh prevents exposure of long-lived credentials

### Testing

The project uses Jest for testing:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

**Test structure:**
- Unit tests for OAuth client, SmartThings client, and actions
- Mocked API responses for deterministic testing
- Test utilities in `__tests__/test-utils.ts`

### Code Quality

The project uses automated code quality tools:

```bash
# Format code with Prettier
npm run format

# Lint with ESLint
npm run lint

# Lint and auto-fix issues
npm run lint:fix
```

**Pre-commit hooks:**
- Automatically runs Prettier and ESLint on staged files
- Ensures all committed code is formatted and lint-free
- Powered by Husky and lint-staged

### Hosting Your Own OAuth Callback

The plugin currently uses `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html` for the OAuth callback. To host your own:

1. **Deploy the callback page:**
   - The callback page repo is at `/Users/thibaut.sabot/Projects/streamdeck-smartthings-oauth/`
   - Deploy to Vercel, Netlify, or any static host
   ```bash
   cd /path/to/streamdeck-smartthings-oauth
   vercel --prod
   ```

2. **Update the plugin:**
   - Edit [src/utils/oauth-client.ts](src/utils/oauth-client.ts):
   ```typescript
   redirectUri: 'https://YOUR-URL.vercel.app/oauth-callback.html',
   ```

3. **Update SmartThings:**
   - Add your new URL to the Redirect URIs in SmartThings Developer Workspace

4. **Rebuild:**
   ```bash
   npm run build
   ```

### Contributing

Contributions are welcome! Here's how you can help:

#### Adding Support for New Device Types

1. Create a new action class in `src/actions/` extending `BaseDevice`
2. Implement device-specific logic (capabilities, commands)
3. Add property inspector HTML in `src/actions/your-device/property-inspector/`
4. Add device icon to `com.thibautsabot.streamdeck.smartthings.sdPlugin/imgs/actions/`
5. Register action in `manifest.json`
6. Add tests in `src/actions/__tests__/`

#### Reporting Issues

- Check existing issues first
- Include Stream Deck software version
- Include plugin version
- Include relevant logs (check Stream Deck console)
- Describe expected vs actual behavior

#### Pull Requests

- Fork the repository
- Create a feature branch (`git checkout -b feature/amazing-feature`)
- Make your changes with tests
- Run linting and tests (`npm run lint && npm test`)
- Commit with clear messages
- Push to your fork
- Open a Pull Request

### Release Process

1. Update version in `package.json` and `manifest.json`
2. Update changelog
3. Build: `npm run build`
4. Create release package (zip the `.sdPlugin` folder)
5. Tag release: `git tag v1.x.x && git push --tags`
6. Create GitHub release with the package

### Troubleshooting

**"Invalid redirect_uri" error:**
- Verify the redirect URI in code matches SmartThings Developer Workspace exactly
- Must include full URL with `https://` and `/oauth-callback.html`

**Code exchange fails:**
- Authorization codes expire after a few minutes
- Ensure you're copying the entire code (no extra spaces)
- Verify Client ID and Secret are correct

**Devices not showing:**
- Check that you selected all required scopes in SmartThings app
- Try re-authorizing
- Check Stream Deck console for API errors

**Token refresh fails:**
- Refresh token may have been revoked
- Re-authorize the plugin

### Resources

- [SmartThings API Documentation](https://smartthings.developer.samsung.com/docs)
- [Stream Deck SDK Documentation](https://docs.elgato.com/sdk)
- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built from [typescript-streamdeck-boilerplate](https://github.com/thibautsabot/typescript-streamdeck-boilerplate/)
- SmartThings API by Samsung
- Stream Deck by Elgato
