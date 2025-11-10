import { DeviceSettingsInterface, GlobalSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent, StreamDeckAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from 'streamdeck-typescript'
import { fetchApi, isGlobalSettingsSet } from '../utils/index'
import { DeviceStatus, Device } from '@smartthings/core-sdk'
import { Smartthings } from '../smartthings-plugin'

type DeviceType = 'light' | 'switch' | 'garagedoor' | 'unknown'

export class DeviceAction extends StreamDeckAction<Smartthings, DeviceAction> {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private aggressivePollingTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private readonly POLL_INTERVAL_MS = 5000 // Normal polling: every 5 seconds
  private readonly AGGRESSIVE_POLL_INTERVAL_MS = 500 // Aggressive polling: every 0.5 seconds
  private readonly AGGRESSIVE_POLL_DURATION_MS = 10000 // Poll aggressively for 10 seconds after button press

  constructor(public plugin: Smartthings, private actionName: string) {
    super(plugin, actionName)
  }

  private setDeviceImage(context: string, imageName: string): void {
    // Use setState to switch between on/off states (0 = off/closed, 1 = on/open)
    const isOn = imageName.includes('_on') || imageName.includes('open')
    const state = isOn ? 1 : 0
    console.log(`[Device] Setting state to: ${state} (${imageName})`)
    this.plugin.setState(state, context)
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

  @SDOnActionEvent('didReceiveSettings')
  public async onDidReceiveSettings({ context, payload }: DidReceiveSettingsEvent<DeviceSettingsInterface>): Promise<void> {
    // Update state when settings are received
    await this.updateDeviceState(context, payload.settings)
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

  private startAggressivePolling(context: string, settings: DeviceSettingsInterface): void {
    console.log(`[Device] Starting aggressive polling for ${context}`)

    // Clear any existing aggressive polling
    this.stopAggressivePolling(context)

    // Stop normal polling temporarily
    this.stopPolling(context)

    // Start aggressive polling (every 0.5 seconds)
    const aggressiveInterval = setInterval(async () => {
      await this.updateDeviceState(context, settings)
    }, this.AGGRESSIVE_POLL_INTERVAL_MS)

    this.pollingIntervals.set(context, aggressiveInterval)

    // After 10 seconds, switch back to normal polling
    const timeout = setTimeout(() => {
      console.log(`[Device] Switching back to normal polling for ${context}`)
      this.stopPolling(context)
      this.startPolling(context, settings)
      this.aggressivePollingTimeouts.delete(context)
    }, this.AGGRESSIVE_POLL_DURATION_MS)

    this.aggressivePollingTimeouts.set(context, timeout)
  }

  private stopAggressivePolling(context: string): void {
    const timeout = this.aggressivePollingTimeouts.get(context)
    if (timeout) {
      clearTimeout(timeout)
      this.aggressivePollingTimeouts.delete(context)
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

      // Update image for garage doors
      if ('doorControl' in (deviceStatus.components?.main || {})) {
        const doorValue = deviceStatus.components?.main?.doorControl?.door?.value
        const imageName = doorValue === 'closed' ? 'garage_door_closed' : 'garage_door_open'
        const expectedState = doorValue === 'closed' ? 0 : 1
        console.log(`[Device] Garage door ${deviceId}: doorValue="${doorValue}" -> imageName="${imageName}" -> expectedState=${expectedState}`)
        this.setDeviceImage(context, imageName)
      }
      // Update image for switches and lights
      else if ('switch' in (deviceStatus.components?.main || {})) {
        const switchValue = deviceStatus.components?.main?.switch?.switch?.value
        // Determine if this is a light or a regular switch based on device capabilities
        const hasLightCapability = 'switchLevel' in (deviceStatus.components?.main || {})

        const deviceType = hasLightCapability ? 'light' : 'switch'
        const imageName = `${deviceType}_${switchValue}`
        console.log(`[Device] ${deviceType} ${deviceId}: ${switchValue} -> ${imageName}`)
        this.setDeviceImage(context, imageName)
      }
    } catch (error: any) {
      console.error(`[Device] Error updating device state for ${settings.deviceId}:`, error)

      // Show alert icon if device is offline/unavailable
      if (error.status === 424 || error.status === 503 || error.status === 504) {
        console.warn(`[Device] Device ${settings.deviceId} appears to be offline (HTTP ${error.status})`)
        await this.plugin.setTitle('⚠️ OFFLINE', context)
      }
    }
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({ context, payload }: KeyUpEvent<DeviceSettingsInterface>): Promise<void> {
    console.log(`[Device] keyUp event - current state: ${payload.state}, deviceId: ${payload.settings.deviceId}`)
    const globalSettings = this.plugin.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (isGlobalSettingsSet(globalSettings)) {
      const token = globalSettings.accessToken
      const deviceId = payload.settings.deviceId

      try {
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
        const behaviour = payload.settings.behaviour || 'toggle' // Default to toggle if not set
        switch (behaviour) {
          case 'toggle':
            const isActive = deviceStatus.components.main.switch.switch.value === 'on'
            console.log(`[Device] Toggling switch - current state: ${isActive ? 'on' : 'off'}`)
            console.log(`[Device] Sending command: ${isActive ? 'off' : 'on'} to device ${deviceId}`)
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
            console.log(`[Device] Command sent successfully`)

            // Update image immediately after toggle
            const hasLightCapability = 'switchLevel' in deviceStatus.components.main
            const deviceType = hasLightCapability ? 'light' : 'switch'
            const newValue = isActive ? 'off' : 'on'
            const imageName = `${deviceType}_${newValue}`
            console.log(`[Device] Toggle ${deviceType}: ${isActive ? 'on->off' : 'off->on'} -> ${imageName}`)
            this.setDeviceImage(context, imageName)
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
        try {
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

          // Update image immediately after command (will be confirmed by polling)
          const newValue = isActive ? 'closed' : 'open'
          const imageName = `garage_door_${newValue}`
          console.log(`[Device] Toggle garage door: ${isActive ? 'open->closed' : 'closed->open'} -> ${imageName}`)
          this.setDeviceImage(context, imageName)
        } catch (error: any) {
          console.error(`[Device] Failed to control garage door ${deviceId}:`, error)
          if (error.status === 424) {
            await this.plugin.showAlert(context)
            await this.plugin.setTitle('⚠️ OFFLINE', context)
            console.error(`[Device] Garage door ${deviceId} is offline or unavailable (HTTP 424)`)
          }
        }
      }

      // Start aggressive polling to quickly detect state change
      this.startAggressivePolling(context, payload.settings)
      } catch (error: any) {
        console.error(`[Device] Error in keyUp handler for ${deviceId}:`, error)
        if (error.status === 424 || error.status === 503 || error.status === 504) {
          await this.plugin.showAlert(context)
          await this.plugin.setTitle('⚠️ OFFLINE', context)
        }
      }
    }
  }
}
