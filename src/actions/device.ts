import { DeviceSettingsInterface, GlobalSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent, StreamDeckAction, WillAppearEvent, WillDisappearEvent } from 'streamdeck-typescript'
import { fetchApi, isGlobalSettingsSet } from '../utils/index'

import { DeviceStatus } from '@smartthings/core-sdk'
import { Smartthings } from '../smartthings-plugin'

export class DeviceAction extends StreamDeckAction<Smartthings, DeviceAction> {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private readonly POLL_INTERVAL_MS = 5000 // Poll every 5 seconds

  constructor(public plugin: Smartthings, private actionName: string) {
    super(plugin, actionName)
  }

  @SDOnActionEvent('willAppear')
  public async onWillAppear({ context, payload }: WillAppearEvent<DeviceSettingsInterface>): Promise<void> {
    // Start polling for this device when button appears
    await this.updateDeviceState(context, payload.settings)
    this.startPolling(context, payload.settings)
  }

  @SDOnActionEvent('willDisappear')
  public onWillDisappear({ context }: WillDisappearEvent<DeviceSettingsInterface>): void {
    // Stop polling when button disappears
    this.stopPolling(context)
  }

  private startPolling(context: string, settings: DeviceSettingsInterface): void {
    // Clear any existing interval for this context
    this.stopPolling(context)

    // Set up new polling interval
    const interval = setInterval(async () => {
      await this.updateDeviceState(context, settings)
    }, this.POLL_INTERVAL_MS)

    this.pollingIntervals.set(context, interval)
  }

  private stopPolling(context: string): void {
    const interval = this.pollingIntervals.get(context)
    if (interval) {
      clearInterval(interval)
      this.pollingIntervals.delete(context)
    }
  }

  private async updateDeviceState(context: string, settings: DeviceSettingsInterface): Promise<void> {
    const globalSettings = this.plugin.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (!isGlobalSettingsSet(globalSettings) || !settings.deviceId) {
      return
    }

    try {
      const token = globalSettings.accessToken
      const deviceId = settings.deviceId

      const deviceStatus = await fetchApi<DeviceStatus>({
        endpoint: `/devices/${deviceId}/status`,
        method: 'GET',
        accessToken: token,
      })

      // Update state for garage doors
      if ('doorControl' in (deviceStatus.components?.main || {})) {
        const doorValue = deviceStatus.components?.main?.doorControl?.door?.value
        // State 1 = Closed (green icon), State 2 = Open (red icon)
        const state = doorValue === 'closed' ? 1 : 2
        this.plugin.setState(state, context)
      }
    } catch (error) {
      console.error('Error updating device state:', error)
    }
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({ context, payload }: KeyUpEvent<DeviceSettingsInterface>): Promise<void> {
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

        // Update state immediately after command (will be confirmed by polling)
        // State 1 = Closed, State 2 = Open
        const newState = isActive ? 1 : 2
        this.plugin.setState(newState, context)
      }
    }
  }
}
