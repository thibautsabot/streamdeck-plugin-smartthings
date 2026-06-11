import 'isomorphic-fetch'
import { BaseDeviceAction } from '../base-device'
import { Smartthings } from '../../smartthings-plugin'
import { FakeStreamdeckApi } from '../../utils/fakeApi'
import { DeviceSettingsInterface } from '../../utils/interface'

// Create a concrete test class since BaseDeviceAction is abstract
class TestDeviceAction extends BaseDeviceAction<TestDeviceAction> {
  public updateDeviceStateCalls: Array<{ context: string; settings: DeviceSettingsInterface }> = []

  protected async updateDeviceState(
    context: string,
    settings: DeviceSettingsInterface,
  ): Promise<void> {
    this.updateDeviceStateCalls.push({ context, settings })
  }
}

describe('BaseDeviceAction', () => {
  let testAction: TestDeviceAction
  let fakePlugin: Smartthings

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    fakePlugin = new FakeStreamdeckApi() as Smartthings
    testAction = new TestDeviceAction(fakePlugin, 'com.test.device')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('onWillAppear', () => {
    it('should update device state and start polling', async () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      await testAction.onWillAppear({
        context,
        payload: { settings },
      } as any)

      expect(testAction.updateDeviceStateCalls).toHaveLength(1)
      expect(testAction.updateDeviceStateCalls[0]).toEqual({ context, settings })
    })
  })

  describe('onWillDisappear', () => {
    it('should stop polling when button disappears', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startPolling'](context, settings)
      expect(testAction['pollingIntervals'].has(context)).toBe(true)

      testAction.onWillDisappear({ context } as any)

      expect(testAction['pollingIntervals'].has(context)).toBe(false)
    })
  })

  describe('onDidReceiveSettings', () => {
    it('should update device state when settings change', async () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-456' }

      await testAction.onDidReceiveSettings({
        context,
        payload: { settings },
      } as any)

      expect(testAction.updateDeviceStateCalls).toHaveLength(1)
      expect(testAction.updateDeviceStateCalls[0]).toEqual({ context, settings })
    })
  })

  describe('polling', () => {
    it('should poll device state every 60 seconds', async () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startPolling'](context, settings)

      // Initial call already happened in setup
      expect(testAction.updateDeviceStateCalls).toHaveLength(0)

      // Advance 60 seconds
      jest.advanceTimersByTime(60000)
      await Promise.resolve()

      expect(testAction.updateDeviceStateCalls).toHaveLength(1)

      // Advance another 60 seconds
      jest.advanceTimersByTime(60000)
      await Promise.resolve()

      expect(testAction.updateDeviceStateCalls).toHaveLength(2)
    })

    it('should stop polling when stopPolling is called', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startPolling'](context, settings)
      expect(testAction['pollingIntervals'].has(context)).toBe(true)

      testAction['stopPolling'](context)
      expect(testAction['pollingIntervals'].has(context)).toBe(false)

      // Should not poll after stopping
      jest.advanceTimersByTime(60000)
      expect(testAction.updateDeviceStateCalls).toHaveLength(0)
    })

    it('should clear existing interval when startPolling called again', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startPolling'](context, settings)
      const firstInterval = testAction['pollingIntervals'].get(context)

      testAction['startPolling'](context, settings)
      const secondInterval = testAction['pollingIntervals'].get(context)

      expect(firstInterval).not.toBe(secondInterval)
    })
  })

  describe('aggressive polling', () => {
    it('should poll every 2 seconds during aggressive mode', async () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startAggressivePolling'](context, settings)

      // Advance 2 seconds - first poll
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve() // Extra tick for async callbacks

      expect(testAction.updateDeviceStateCalls.length).toBeGreaterThanOrEqual(1)

      // Advance another 2 seconds - second poll
      jest.advanceTimersByTime(2000)
      await Promise.resolve()
      await Promise.resolve()

      expect(testAction.updateDeviceStateCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('should switch back to normal polling after 6 seconds', async () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startAggressivePolling'](context, settings)

      // Poll aggressively for 6 seconds
      jest.advanceTimersByTime(6000)
      await Promise.resolve()
      await Promise.resolve()

      // Should have polled at least twice during aggressive mode
      expect(testAction.updateDeviceStateCalls.length).toBeGreaterThanOrEqual(2)

      // Clear calls and continue
      testAction.updateDeviceStateCalls = []

      // After 6s, should switch to normal 60s polling
      jest.advanceTimersByTime(60000)
      await Promise.resolve()
      await Promise.resolve()

      expect(testAction.updateDeviceStateCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should stop normal polling when aggressive polling starts', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startPolling'](context, settings)
      const normalInterval = testAction['pollingIntervals'].get(context)

      testAction['startAggressivePolling'](context, settings)
      const aggressiveInterval = testAction['pollingIntervals'].get(context)

      expect(normalInterval).not.toBe(aggressiveInterval)
    })

    it('should clear existing aggressive polling timeout when called again', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startAggressivePolling'](context, settings)
      expect(testAction['aggressivePollingTimeouts'].has(context)).toBe(true)

      testAction['startAggressivePolling'](context, settings)
      expect(testAction['aggressivePollingTimeouts'].has(context)).toBe(true)
    })

    it('should stop aggressive polling timeout', () => {
      const context = 'test-context'
      const settings = { deviceId: 'device-123' }

      testAction['startAggressivePolling'](context, settings)
      expect(testAction['aggressivePollingTimeouts'].has(context)).toBe(true)

      testAction['stopAggressivePolling'](context)
      expect(testAction['aggressivePollingTimeouts'].has(context)).toBe(false)
    })
  })

  describe('fetchStatus', () => {
    it('should fetch device status from SmartThings API', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ components: { main: {} } }),
      } as any)

      await testAction['fetchStatus']('device-123', 'access-token')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.smartthings.com/v1/devices/device-123/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer access-token',
          }),
        }),
      )

      mockFetch.mockRestore()
    })
  })

  describe('sendCommand', () => {
    it('should send command to device', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as any)

      const consoleLog = jest.spyOn(console, 'log').mockImplementation()

      await testAction['sendCommand']('device-123', 'access-token', 'switch', 'on')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.smartthings.com/v1/devices/device-123/commands',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify([
            {
              capability: 'switch',
              command: 'on',
            },
          ]),
        }),
      )

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Sending command to device device-123: switch on'),
      )

      mockFetch.mockRestore()
      consoleLog.mockRestore()
    })

    it('should send command with arguments', async () => {
      const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as any)

      await testAction['sendCommand']('device-123', 'access-token', 'switchLevel', 'setLevel', [50])

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.smartthings.com/v1/devices/device-123/commands',
        expect.objectContaining({
          body: JSON.stringify([
            {
              capability: 'switchLevel',
              command: 'setLevel',
              arguments: [50],
            },
          ]),
        }),
      )

      mockFetch.mockRestore()
    })
  })
})
