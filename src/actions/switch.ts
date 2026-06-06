import { DeviceSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'

export class SwitchAction extends BaseDeviceAction<SwitchAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  protected async updateDeviceState(
    context: string,
    settings: DeviceSettingsInterface
  ): Promise<void> {
    const globalSettings = this.getGlobalSettings()
    if (!globalSettings || !settings.deviceId) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, globalSettings.accessToken)
      const switchValue = deviceStatus.components?.main?.switch?.switch?.value

      if (!switchValue) {
        console.warn(`[Switch] Device ${settings.deviceId} missing switch capability`)
        return
      }

      const state = switchValue === 'on' ? 1 : 0
      this.plugin.setState(state, context)
      await this.plugin.setTitle('', context)
    } catch (error) {
      await this.handleError(context, error, settings.deviceId)
    }
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({ context, payload }: KeyUpEvent<DeviceSettingsInterface>): Promise<void> {
    const globalSettings = this.getGlobalSettings()
    if (!globalSettings) return

    try {
      const deviceStatus = await this.fetchStatus(
        payload.settings.deviceId,
        globalSettings.accessToken
      )
      const isOn = deviceStatus.components?.main?.switch?.switch?.value === 'on'

      await this.sendCommand(
        payload.settings.deviceId,
        globalSettings.accessToken,
        'switch',
        isOn ? 'off' : 'on'
      )

      this.plugin.setState(isOn ? 0 : 1, context)
      this.startAggressivePolling(context, payload.settings)
    } catch (error) {
      await this.plugin.showAlert(context)
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
