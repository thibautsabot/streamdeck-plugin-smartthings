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

Before you can use the plugin, you need to create an OAuth application in the SmartThings CLI:
<video src="oauth.mp4" width="320" height="240" controls></video>


1. Install the [Smartthings CLI Github](https://github.com/SmartThingsCommunity/smartthings-cli#installation)
2. Run `smartthings apps:create` in your terminal
3. Select `OAuth-In App`
4. Configure your app:
   - **Display Name**: Your choice (e.g., "Stream Deck Integration")
   - **Description**: Anything you want
   - Icon Image URL: Leave blank
   - Target URL: Leave blank
   - **Scopes**: Select at least:
     - `r:devices:*` (Read devices)
     - `x:devices:*` (Execute device commands)
     - `r:scenes:*` (Read scenes)
     - `x:scenes:*` (Execute scenes)
   - Select **Add Rediction URI.** and press Enter.
   - **Add this redirect URI: `https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html`** (If you don't trust the URL or are curious about the code, head over to [this repo](https://github.com/thibautsabot/streamdeck-smartthings-oauth). You can even host it yourself)

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
   - You should see "✓ Connected to SmartThings"
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

- Node.js (v20 or later recommended)
- npm
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


**Devices not showing:**
- Check that you selected all required scopes in SmartThings app
- Try re-authorizing
- Check Stream Deck console for API errors
