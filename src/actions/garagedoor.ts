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
    if (!settings.deviceId) return

    const accessToken = await this.getAccessToken()
    if (!accessToken) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, accessToken)
      const doorValue = DeviceCapabilities.getDoorValue(deviceStatus)

      if (doorValue === null) {
        console.warn(`[GarageDoor] Device ${settings.deviceId} missing doorControl capability`)
        return
      }

      // Map door states to button states and set titles for intermediate states
      const isOpen = doorValue === DoorValue.OPEN || doorValue === DoorValue.OPENING
      const state = isOpen ? 1 : 0

      let title = ''
      switch (doorValue) {
        case DoorValue.OPENING:
          title = '⬆️ OPENING'
          break
        case DoorValue.CLOSING:
          title = '⬇️ CLOSING'
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
    if (action !== 'com.thibautsabot.streamdeck.smartthings.garagedoor') return

    const accessToken = await this.getAccessToken()
    if (!accessToken) return

    try {
      const deviceStatus = await this.fetchStatus(payload.settings.deviceId, accessToken)

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
        accessToken,
        'doorControl',
        isOpen ? 'close' : 'open',
      )

      this.plugin.setState(isOpen ? 0 : 1, context)
    } catch (error) {
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
