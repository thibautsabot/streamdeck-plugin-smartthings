import { SceneAction } from './actions/scene'
import { LightAction } from './actions/light'
import { SwitchAction } from './actions/switch'
import { GarageDoorAction } from './actions/garagedoor'
import { SDOnActionEvent, StreamDeckPluginHandler } from 'streamdeck-typescript'
import { handleTokenRequest, SendToPluginEventLike } from './utils/plugin-token'

export class Smartthings extends StreamDeckPluginHandler {
  constructor() {
    super()

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
    await handleTokenRequest(this, event)
  }
}

new Smartthings()
