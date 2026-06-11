import { SceneAction } from './actions/scene'
import { LightAction } from './actions/light'
import { SwitchAction } from './actions/switch'
import { GarageDoorAction } from './actions/garagedoor'
import { StreamDeckPluginHandler } from 'streamdeck-typescript'

export class Smartthings extends StreamDeckPluginHandler {
  constructor() {
    super()
    new SceneAction(this, 'com.thibautsabot.streamdeck.smartthings.scene')
    new LightAction(this, 'com.thibautsabot.streamdeck.smartthings.light')
    new SwitchAction(this, 'com.thibautsabot.streamdeck.smartthings.switch')
    new GarageDoorAction(this, 'com.thibautsabot.streamdeck.smartthings.garagedoor')
  }
}

new Smartthings()
