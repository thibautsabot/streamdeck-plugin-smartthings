import { SceneAction } from './actions/scene'
import { DeviceAction } from './actions/device'
import { LightAction } from './actions/light'
import { SwitchAction } from './actions/switch'
import { GarageDoorAction } from './actions/garagedoor'
import { StreamDeckPluginHandler } from 'streamdeck-typescript'

export class Smartthings extends StreamDeckPluginHandler {
  constructor() {
    super()
    new SceneAction(this, 'com.thibautsabot.streamdeck.scene')
    new DeviceAction(this, 'com.thibautsabot.streamdeck.device')
    new LightAction(this, 'com.thibautsabot.streamdeck.light')
    new SwitchAction(this, 'com.thibautsabot.streamdeck.switch')
    new GarageDoorAction(this, 'com.thibautsabot.streamdeck.garagedoor')
  }
}

new Smartthings()
