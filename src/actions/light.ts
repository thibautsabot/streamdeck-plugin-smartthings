import { LightSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'
import { DeviceCapabilities, SwitchValue, LightBehavior } from '../utils/smartthings-types'

export class LightAction extends BaseDeviceAction<LightAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  protected async updateDeviceState(
    context: string,
    settings: LightSettingsInterface
  ): Promise<void> {
    const globalSettings = this.getGlobalSettings()
    if (!globalSettings || !settings.deviceId) return

    try {
      const deviceStatus = await this.fetchStatus(settings.deviceId, globalSettings.accessToken)
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
  public async onKeyUp({ context, payload }: KeyUpEvent<LightSettingsInterface>): Promise<void> {
    const globalSettings = this.getGlobalSettings()
    if (!globalSettings) return

    const behaviour = payload.settings.behaviour ?? LightBehavior.TOGGLE

    try {
      const deviceStatus = await this.fetchStatus(
        payload.settings.deviceId,
        globalSettings.accessToken
      )

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
          await this.sendCommand(
            payload.settings.deviceId,
            globalSettings.accessToken,
            'switch',
            newCommand
          )
          this.plugin.setState(isOn ? 0 : 1, context)
          break

        case LightBehavior.MORE:
          const currentLevel = DeviceCapabilities.getSwitchLevel(deviceStatus)
          if (currentLevel === null) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`
            )
            await this.plugin.showAlert(context)
            return
          }
          const nextLevel = Math.min(currentLevel + 10, 100)
          await this.sendCommand(
            payload.settings.deviceId,
            globalSettings.accessToken,
            'switchLevel',
            'setLevel',
            [nextLevel]
          )
          break

        case LightBehavior.LESS:
          const level = DeviceCapabilities.getSwitchLevel(deviceStatus)
          if (level === null) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`
            )
            await this.plugin.showAlert(context)
            return
          }
          const prevLevel = Math.max(level - 10, 0)
          await this.sendCommand(
            payload.settings.deviceId,
            globalSettings.accessToken,
            'switchLevel',
            'setLevel',
            [prevLevel]
          )
          break
      }

      this.startAggressivePolling(context, payload.settings)
    } catch (error) {
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
