import { LightSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'
import { DeviceCapabilities, SwitchValue, LightBehavior } from '../utils/smartthings-types'

export class LightAction extends BaseDeviceAction<LightAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  /**
   * Updates the StreamDeck button's visual state (on/off).
   * Note: We check the switch capability (not switchLevel/dimming) because the button
   * only has 2 visual states: ON or OFF. The dimming behavior (MORE/LESS) is handled
   * separately in onKeyUp when the user presses the button.
   */
  protected async updateDeviceState(
    context: string,
    settings: LightSettingsInterface,
  ): Promise<void> {
    if (!settings.deviceId) return

    const accessToken = await this.getAccessToken()
    if (!accessToken) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, accessToken)
      const switchValue = DeviceCapabilities.getSwitchValue(deviceStatus)

      if (switchValue === null) {
        console.warn(`[Light] Device ${settings.deviceId} missing switch capability`)
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
  }: KeyUpEvent<LightSettingsInterface>): Promise<void> {
    if (action !== 'com.thibautsabot.streamdeck.light') return

    const accessToken = await this.getAccessToken()
    if (!accessToken) return

    const behaviour = payload.settings.behaviour ?? LightBehavior.TOGGLE

    try {
      const deviceStatus = await this.fetchStatus(payload.settings.deviceId, accessToken)

      const switchValue = DeviceCapabilities.getSwitchValue(deviceStatus)
      if (switchValue === null) {
        console.warn(`[Light] Device ${payload.settings.deviceId} missing switch capability`)
        await this.plugin.showAlert(context)
        return
      }

      switch (behaviour) {
        case LightBehavior.TOGGLE:
          const isOn = switchValue === SwitchValue.ON
          const newCommand = isOn ? SwitchValue.OFF : SwitchValue.ON
          await this.sendCommand(payload.settings.deviceId, accessToken, 'switch', newCommand)
          this.plugin.setState(isOn ? 0 : 1, context)
          break

        case LightBehavior.MORE:
          const currentLevel = DeviceCapabilities.getSwitchLevel(deviceStatus)
          if (currentLevel === null) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`,
            )
            await this.plugin.showAlert(context)
            return
          }
          const nextLevel = Math.min(currentLevel + 10, 100)
          await this.sendCommand(
            payload.settings.deviceId,
            accessToken,
            'switchLevel',
            'setLevel',
            [nextLevel],
          )
          break

        case LightBehavior.LESS:
          const level = DeviceCapabilities.getSwitchLevel(deviceStatus)
          if (level === null) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`,
            )
            await this.plugin.showAlert(context)
            return
          }
          const prevLevel = Math.max(level - 10, 0)
          await this.sendCommand(
            payload.settings.deviceId,
            accessToken,
            'switchLevel',
            'setLevel',
            [prevLevel],
          )
          break
      }
    } catch (error) {
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
