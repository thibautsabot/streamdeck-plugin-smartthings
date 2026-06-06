import { DeviceSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { Smartthings } from '../smartthings-plugin'
import { BaseDeviceAction } from './base-device'

export class LightAction extends BaseDeviceAction<LightAction> {
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
        console.warn(`[Light] Device ${settings.deviceId} missing switch capability`)
        return
      }

      const state = switchValue === 'on' ? 1 : 0
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

    const behaviour = payload.settings.behaviour || 'toggle'

    try {
      const deviceStatus = await this.fetchStatus(
        payload.settings.deviceId,
        globalSettings.accessToken
      )

      const switchValue = deviceStatus.components?.main?.switch?.switch?.value
      if (!switchValue) {
        console.warn(`[Light] Device ${payload.settings.deviceId} missing switch capability`)
        await this.plugin.showAlert(context)
        return
      }

      switch (behaviour) {
        case 'toggle':
          const isOn = switchValue === 'on'
          await this.sendCommand(
            payload.settings.deviceId,
            globalSettings.accessToken,
            'switch',
            isOn ? 'off' : 'on'
          )
          this.plugin.setState(isOn ? 0 : 1, context)
          break

        case 'more':
          const currentLevel = deviceStatus.components?.main?.switchLevel?.level?.value
          if (currentLevel === undefined) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`
            )
            await this.plugin.showAlert(context)
            return
          }
          const nextLevel = Math.min(currentLevel as number + 10, 100)
          await this.sendCommand(
            payload.settings.deviceId,
            globalSettings.accessToken,
            'switchLevel',
            'setLevel',
            [nextLevel]
          )
          break

        case 'less':
          const level = deviceStatus.components?.main?.switchLevel?.level?.value
          if (level === undefined) {
            console.warn(
              `[Light] Device ${payload.settings.deviceId} doesn't support dimming - use Switch action instead`
            )
            await this.plugin.showAlert(context)
            return
          }
          const prevLevel = Math.max((level as number) - 10, 0)
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
      await this.plugin.showAlert(context)
      await this.handleError(context, error, payload.settings.deviceId)
    }
  }
}
