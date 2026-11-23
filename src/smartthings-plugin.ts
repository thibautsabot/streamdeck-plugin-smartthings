import { SceneAction } from './actions/scene'
import { LightAction } from './actions/light'
import { SwitchAction } from './actions/switch'
import { GarageDoorAction } from './actions/garagedoor'
import { SDOnActionEvent, StreamDeckPluginHandler } from 'streamdeck-typescript'
import { handleTokenRequest, SendToPluginEventLike } from './utils/plugin-token'
import { installCrashLogging, installLogForwarding, PLUGIN_VERSION } from './utils/logger'
import { SettingsWatcher } from './utils/settings-watcher'
import { CredentialStore } from './utils/credential-store'

export class Smartthings extends StreamDeckPluginHandler {
  private settingsWatcher = new SettingsWatcher()
  /** The plugin's own copy of the credentials, see CredentialStore */
  public credentials: CredentialStore

  constructor() {
    super()

    // Stream Deck only keeps what goes through logMessage, so mirror console there
    installLogForwarding((message) => this.logMessage(message), 'plugin')
    installCrashLogging(window)
    // Created after the log forwarding so that storage errors reach the Stream Deck log
    this.credentials = new CredentialStore()
    console.log(`Plugin starting, version ${PLUGIN_VERSION}`)
    console.log(
      this.credentials.get()
        ? 'Found a credentials backup from a previous run'
        : 'No credentials backup from a previous run',
    )

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
      this.credentials.forget()
      return
    }
    await handleTokenRequest(this, event)
  }

  /**
   * Stream Deck owns the saved credentials, but it can hand back empty or older ones: the SDK
   * stores whatever arrives (before this handler runs), so the plugin compares it with its own
   * copy and puts its copy back when what arrived is worse.
   */
  @SDOnActionEvent('didReceiveGlobalSettings')
  public onDidReceiveGlobalSettings(event: { payload?: { settings?: unknown } }): void {
    const incoming = event?.payload?.settings
    this.settingsWatcher.record(incoming, 'plugin')

    const decision = this.credentials.reconcile(incoming)
    if (decision.action === 'restore') {
      console.warn(`${decision.reason}: restoring the plugin's own copy`)
      // Updates the SDK's copy and writes it back to Stream Deck
      this.settingsManager.setGlobalSettings(decision.credentials)
    }
  }
}

new Smartthings()
