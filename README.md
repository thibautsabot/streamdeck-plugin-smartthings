# Smartthings plugin for StreamDeck

A StreamDeck plugin to control your SmartThings devices and scenes with OAuth 2.0 authentication.

Download the release from https://github.com/thibautsabot/streamdeck-plugin-smartthings/releases

Open `com.thibautsabot.streamdeck.smartthings.streamDeckPlugin` and install the plugin!

---

Choose what you need from the list:

<img width="264" alt="Screenshot 2021-03-29 at 11 10 38" src="https://user-images.githubusercontent.com/9283289/112819301-bd3e6d80-9084-11eb-86bd-a6e015268c9f.png">

## Authentication Setup

The plugin uses **OAuth 2.0 authentication** for secure access to your SmartThings devices with automatic token refresh.

### Setting up OAuth

1. **Create a SmartThings OAuth App**
   - Go to [SmartThings Developer Workspace](https://smartthings.developer.samsung.com/workspace)
   - Sign in with your Samsung/SmartThings account
   - Create a new app with the following settings:
     - App Type: **Automation for the SmartThings App**
     - OAuth Client: **Confidential**
     - Redirect URI: `http://localhost:8888/callback`
     - Scopes: Select at least:
       - `r:devices:*` (Read devices)
       - `x:devices:*` (Execute devices)
       - `r:scenes:*` (Read scenes)
       - `x:scenes:*` (Execute scenes)

2. **Get your OAuth credentials**
   - After creating the app, you'll receive:
     - **Client ID**
     - **Client Secret**
   - Keep these credentials safe

3. **Configure the plugin**
   - In StreamDeck, add a SmartThings action (Light, Switch, Garage Door, or Scene)
   - Enter your **Client ID** and **Client Secret**
   - Click "Authorize with SmartThings"
   - A browser window will open - sign in and authorize the plugin
   - Return to StreamDeck - you should see "✓ Authenticated"

4. **Select your device or scene**
   - The plugin will automatically fetch your devices/scenes
   - Select the one you want to control from the dropdown

### Features

- 🔒 **Secure OAuth 2.0** - Industry standard authentication
- 🔄 **Automatic token refresh** - No manual re-authentication needed
- 💾 **Tokens stored locally** - Your credentials never leave your machine
- ⚡ **Fast and reliable** - Direct API communication with SmartThings 

## Informations

Made from https://github.com/thibautsabot/typescript-streamdeck-boilerplate/.

For now, you can only configure Devices and Scene.

You can control any "switch" devices. In theory we can control anything but I don't have the devices to test it out.

Any contribution to the project by opening a Pull Request or an Issue would be greatly appreciated.
