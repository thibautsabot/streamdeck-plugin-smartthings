import { DeviceSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'
import { DeviceCapabilities, DoorValue } from '../utils/smartthings-types'

export class GarageDoorAction extends BaseDeviceAction<GarageDoorAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  protected async updateDeviceState(
    context: string,
    settings: DeviceSettingsInterface,
  ): Promise<void> {
    const globalSettings = this.getGlobalSettings()
    if (!globalSettings || !settings.deviceId) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, globalSettings.accessToken)
      const doorValue = DeviceCapabilities.getDoorValue(deviceStatus)

      if (doorValue === null) {
        console.warn(`[GarageDoor] Device ${settings.deviceId} missing doorControl capability`)
        return
      }

      // Map door states to button states and set titles for intermediate states
      let state: number
      let title = ''

      switch (doorValue) {
        case DoorValue.OPEN:
          state = 1
          break
        case DoorValue.OPENING:
          state = 1
          title = '⬆️ OPENING'
          break
        case DoorValue.CLOSED:
          state = 0
          break
        case DoorValue.CLOSING:
          state = 0
          title = '⬇️ CLOSING'
          break
        case DoorValue.UNKNOWN:
          state = 0
          title = '❓ UNKNOWN'
          break
        default:
          state = 0
          break
      }

      this.plugin.setState(state, context)
      await this.plugin.setTitle(title, context)
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
    if (action !== 'com.thibautsabot.streamdeck.garagedoor') return

    const globalSettings = this.getGlobalSettings()
    if (!globalSettings) return

    try {
      const deviceStatus = await this.fetchStatus(
        payload.settings.deviceId,
        globalSettings.accessToken,
      )

      const doorValue = DeviceCapabilities.getDoorValue(deviceStatus)
      if (doorValue === null) {
        console.warn(
          `[GarageDoor] Device ${payload.settings.deviceId} missing doorControl capability`,
        )
        await this.plugin.showAlert(context)
        return
      }

      const isOpen = doorValue === DoorValue.OPEN

      await this.sendCommand(
        payload.settings.deviceId,
        globalSettings.accessToken,
        'doorControl',
        isOpen ? 'close' : 'open',
      )

      this.plugin.setState(isOpen ? 0 : 1, context)
    } catch (error) {
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
