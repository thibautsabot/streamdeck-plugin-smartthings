import { SceneAction } from './actions/scene'
import { LightAction } from './actions/light'
import { SwitchAction } from './actions/switch'
import { GarageDoorAction } from './actions/garagedoor'
import { SDOnActionEvent, StreamDeckPluginHandler } from 'streamdeck-typescript'
import { handleTokenRequest, SendToPluginEventLike } from './utils/plugin-token'
import { installCrashLogging, installLogForwarding, PLUGIN_VERSION } from './utils/logger'
import { SettingsWatcher } from './utils/settings-watcher'

export class Smartthings extends StreamDeckPluginHandler {
  private settingsWatcher = new SettingsWatcher()

  constructor() {
    super()

    // Stream Deck only keeps what goes through logMessage, so mirror console there
    installLogForwarding((message) => this.logMessage(message), 'plugin')
    installCrashLogging(window)
    console.log(`Plugin starting, version ${PLUGIN_VERSION}`)

    new SceneAction(this, 'com.thibautsabot.streamdeck.smartthings.scene')
    new LightAction(this, 'com.thibautsabot.streamdeck.smartthings.light')
    new SwitchAction(this, 'com.thibautsabot.streamdeck.smartthings.switch')
    new GarageDoorAction(this, 'com.thibautsabot.streamdeck.smartthings.garagedoor')
  }

  /**
   * The property inspector asks the plugin for tokens so that only one process ever refreshes them.
   */
  @SDOnActionEvent('sendToPlugin')
  public async onSendToPlugin(event: SendToPluginEventLike): Promise<void> {
    if (event?.payload?.event === 'expectSignOut') {
      // Tell a deliberate Sign Out apart from settings Stream Deck lost on its own
      this.settingsWatcher.expectClear()
      return
    }
    await handleTokenRequest(this, event)
  }

  /**
   * Stream Deck owns the saved credentials: log what it gives us every time they are
   * delivered. This tells "settings were wiped" apart from "token refresh failed".
   */
  @SDOnActionEvent('didReceiveGlobalSettings')
  public onDidReceiveGlobalSettings(event: { payload?: { settings?: unknown } }): void {
    this.settingsWatcher.record(event?.payload?.settings, 'plugin')
  }
}

new Smartthings()
