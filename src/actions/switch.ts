import { DeviceSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'
import { DeviceCapabilities, SwitchValue } from '../utils/smartthings-types'

export class SwitchAction extends BaseDeviceAction<SwitchAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  protected async updateDeviceState(
    context: string,
    settings: DeviceSettingsInterface,
  ): Promise<void> {
    if (!settings.deviceId) return

    const accessToken = await this.getAccessToken()
    if (!accessToken) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, accessToken)
      const switchValue = DeviceCapabilities.getSwitchValue(deviceStatus)

      if (switchValue === null) {
        console.warn(`[Switch] Device ${settings.deviceId} missing switch capability`)
        return
      }

      const state = switchValue === SwitchValue.ON ? 1 : 0
      this.plugin.setState(state, context)
      await this.clearErrorTitle(context)
    } catch (error) {
      await this.handleError(context, error, settings.deviceId)
    }
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({
    context,
    payload,
    action,
  }: KeyUpEvent<DeviceSettingsInterface>): Promise<void> {
    if (action !== 'com.thibautsabot.streamdeck.smartthings.switch') return

    const accessToken = await this.getAccessToken()

    if (!accessToken) return

    try {
      const deviceStatus = await this.fetchStatus(payload.settings.deviceId, accessToken)

      const switchValue = DeviceCapabilities.getSwitchValue(deviceStatus)
      if (switchValue === null) {
        console.warn(`[Switch] Device ${payload.settings.deviceId} missing switch capability`)
        await this.plugin.showAlert(context)
        return
      }

      const isOn = switchValue === SwitchValue.ON
      const newCommand = isOn ? SwitchValue.OFF : SwitchValue.ON

      await this.sendCommand(payload.settings.deviceId, accessToken, 'switch', newCommand)

      this.plugin.setState(isOn ? 0 : 1, context)
    } catch (error) {
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
