import { DeviceSettingsInterface, GlobalSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent, StreamDeckAction } from 'streamdeck-typescript'
import { fetchApi, isGlobalSettingsSet } from '../utils/index'

import { DeviceStatus } from '@smartthings/core-sdk'
import { Smartthings } from '../smartthings-plugin'

export class DeviceAction extends StreamDeckAction<Smartthings, DeviceAction> {
  constructor(public plugin: Smartthings, private actionName: string) {
    super(plugin, actionName)
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({ payload }: KeyUpEvent<DeviceSettingsInterface>): Promise<void> {
    const globalSettings = this.plugin.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (isGlobalSettingsSet(globalSettings)) {
      const token = globalSettings.accessToken
      const deviceId = payload.settings.deviceId

      const lightStatus = await fetchApi<DeviceStatus>({
        endpoint: `/devices/${deviceId}/status`,
        method: 'GET',
        accessToken: token,
      })

      if (lightStatus.components?.main.switch === undefined) {
        console.warn('Only switch devices are supported at the moment !')
        return
      }

      const isOn = lightStatus.components.main.switch.switch.value === 'on'

      await fetchApi({
        endpoint: `/devices/${deviceId}/commands`,
        method: 'POST',
        accessToken: token,
        body: JSON.stringify([
          {
            capability: 'switch',
            command: isOn ? 'off' : 'on',
          },
        ]),
      })
    }
  }
}
