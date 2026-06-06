import { DeviceSettingsInterface } from '../utils/interface'
import {
  SDOnActionEvent,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
} from 'streamdeck-typescript'
import { fetchApi } from '../utils/index'
import { DeviceStatus } from '@smartthings/core-sdk'
import { Smartthings } from '../smartthings-plugin'
import { BaseAction } from './base-action'

/**
 * Base class for all device actions with shared polling logic
 */
export abstract class BaseDeviceAction<T extends BaseDeviceAction<T>> extends BaseAction<T> {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map()
  private aggressivePollingTimeouts: Map<string, NodeJS.Timeout> = new Map()

  protected readonly POLL_INTERVAL_MS = 5000 // Normal polling: every 5 seconds
  protected readonly AGGRESSIVE_POLL_INTERVAL_MS = 500 // Aggressive polling: every 0.5 seconds
  protected readonly AGGRESSIVE_POLL_DURATION_MS = 10000 // Poll aggressively for 10 seconds after button press

  constructor(public plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  @SDOnActionEvent('willAppear')
  public async onWillAppear({
    context,
    payload,
  }: WillAppearEvent<DeviceSettingsInterface>): Promise<void> {
    await this.updateDeviceState(context, payload.settings)
    this.startPolling(context, payload.settings)
  }

  @SDOnActionEvent('willDisappear')
  public onWillDisappear({ context }: WillDisappearEvent<DeviceSettingsInterface>): void {
    this.stopPolling(context)
    this.stopAggressivePolling(context)
  }

  @SDOnActionEvent('didReceiveSettings')
  public async onDidReceiveSettings({
    context,
    payload,
  }: DidReceiveSettingsEvent<DeviceSettingsInterface>): Promise<void> {
    await this.updateDeviceState(context, payload.settings)
  }

  protected startPolling(context: string, settings: DeviceSettingsInterface): void {
    this.stopPolling(context)

    const interval = setInterval(async () => {
      await this.updateDeviceState(context, settings)
    }, this.POLL_INTERVAL_MS)

    this.pollingIntervals.set(context, interval)
  }

  protected stopPolling(context: string): void {
    const interval = this.pollingIntervals.get(context)
    if (interval) {
      clearInterval(interval)
      this.pollingIntervals.delete(context)
    }
  }

  protected startAggressivePolling(context: string, settings: DeviceSettingsInterface): void {
    console.log(`[${this.constructor.name}] Starting aggressive polling for ${context}`)

    this.stopAggressivePolling(context)
    this.stopPolling(context)

    const aggressiveInterval = setInterval(async () => {
      await this.updateDeviceState(context, settings)
    }, this.AGGRESSIVE_POLL_INTERVAL_MS)

    this.pollingIntervals.set(context, aggressiveInterval)

    const timeout = setTimeout(() => {
      console.log(`[${this.constructor.name}] Switching back to normal polling for ${context}`)
      this.stopPolling(context)
      this.startPolling(context, settings)
      this.aggressivePollingTimeouts.delete(context)
    }, this.AGGRESSIVE_POLL_DURATION_MS)

    this.aggressivePollingTimeouts.set(context, timeout)
  }

  protected stopAggressivePolling(context: string): void {
    const timeout = this.aggressivePollingTimeouts.get(context)
    if (timeout) {
      clearTimeout(timeout)
      this.aggressivePollingTimeouts.delete(context)
    }
  }

  /**
   * Helper for fetching device status from SmartThings API.
   * For custom endpoints or special cases, use fetchApi() directly.
   */
  protected async fetchStatus(deviceId: string, accessToken: string): Promise<DeviceStatus> {
    return await fetchApi<DeviceStatus>({
      endpoint: `/devices/${deviceId}/status`,
      method: 'GET',
      accessToken,
    })
  }

  /**
   * Helper for sending commands to devices using standard SmartThings format.
   * For custom body structure or endpoints, use fetchApi() directly.
   */
  protected async sendCommand(
    deviceId: string,
    accessToken: string,
    capability: string,
    command: string,
    args?: any[]
  ): Promise<void> {
    await fetchApi({
      endpoint: `/devices/${deviceId}/commands`,
      method: 'POST',
      accessToken,
      body: JSON.stringify([
        {
          capability,
          command,
          ...(args && { arguments: args }),
        },
      ]),
    })
  }

  /**
   * Subclasses must implement this to update device-specific state
   */
  protected abstract updateDeviceState(
    context: string,
    settings: DeviceSettingsInterface
  ): Promise<void>
}
