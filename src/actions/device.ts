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
        return
      }

      if ('switch' in deviceStatus.components.main) {
        switch (payload.settings.behaviour) {
          case 'toggle':
            const isActive = deviceStatus.components.main.switch.switch.value === 'on'
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
            break
          case 'more':
            const nextLevel = ((deviceStatus.components.main.switchLevel.level
              .value as number) += 10)
            await fetchApi({
              endpoint: `/devices/${deviceId}/commands`,
              method: 'POST',
              accessToken: token,
              body: JSON.stringify([
                {
                  capability: 'switchLevel',
                  command: 'setLevel',
                  arguments: [nextLevel > 100 ? 100 : nextLevel],
                },
              ]),
            })
            break
          case 'less':
            const prevLevel = ((deviceStatus.components.main.switchLevel.level
              .value as number) -= 10)
            await fetchApi({
              endpoint: `/devices/${deviceId}/commands`,
              method: 'POST',
              accessToken: token,
              body: JSON.stringify([
                {
                  capability: 'switchLevel',
                  command: 'setLevel',
                  arguments: [prevLevel < 0 ? 0 : prevLevel],
                },
              ]),
            })
            break
        }
      }
      if ('doorControl' in deviceStatus.components?.main) {
        const isActive = deviceStatus.components.main.doorControl.door.value === 'open'
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
