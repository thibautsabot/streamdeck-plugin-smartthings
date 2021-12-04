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

      const deviceStatus = await fetchApi<DeviceStatus>({
        endpoint: `/devices/${deviceId}/status`,
        method: 'GET',
        accessToken: token,
      })

      if (
          deviceStatus.components?.main.switch === undefined &&
          deviceStatus.components?.main.doorControl === undefined
    ) {
        console.warn('Only switch devices and Garage Doors are supported at the moment !')
        console.info(deviceStatus)
        return
      }

      if ('switch' in deviceStatus.components.main) {
        const isActive = deviceStatus.components.main.switch.switch.value === 'on'
        console.log(isActive)
        await fetchApi({
          endpoint: `/devices/${deviceId}/commands`,
          method: 'POST',
          accessToken: token,
          body: JSON.stringify([
            {
              capability: 'switch',
              command: isActive ? 'off' : 'on',
            },
          ]),
        })
      }
      if ('doorControl' in deviceStatus.components?.main) {
        const isActive = deviceStatus.components.main.doorControl.door.value === 'open'
        console.log(isActive)
        await fetchApi({
          endpoint: `/devices/${deviceId}/commands`,
          method: 'POST',
          accessToken: token,
          body: JSON.stringify([
            {
              capability: 'doorControl',
              command: isActive ? 'close' : 'open',
            },
          ]),
        })
      }
    }
  }
}
