import { DeviceSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'

export class GarageDoorAction extends BaseDeviceAction<GarageDoorAction> {
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
      const doorValue = deviceStatus.components?.main?.doorControl?.door?.value

      if (!doorValue) {
        console.warn(`[GarageDoor] Device ${settings.deviceId} missing doorControl capability`)
        return
      }

      const state = doorValue === 'open' ? 1 : 0
      this.plugin.setState(state, context)
      await this.clearErrorTitle(context)
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

      const doorValue = deviceStatus.components?.main?.doorControl?.door?.value
      if (!doorValue) {
        console.warn(
          `[GarageDoor] Device ${payload.settings.deviceId} missing doorControl capability`
        )
        await this.plugin.showAlert(context)
        return
      }

      const isOpen = doorValue === 'open'

      await this.sendCommand(
        payload.settings.deviceId,
        globalSettings.accessToken,
        'doorControl',
        isOpen ? 'close' : 'open'
      )

      this.plugin.setState(isOpen ? 0 : 1, context)
      this.startAggressivePolling(context, payload.settings)
    } catch (error) {
      await this.plugin.showAlert(context)
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}

