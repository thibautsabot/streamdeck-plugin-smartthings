/**
 * Shared test helpers for action tests
 */

import { GlobalSettingsInterface } from '../utils/interface'
import { http, HttpResponse } from 'msw'
import { DeviceStatus } from '@smartthings/core-sdk'

/**
 * Mock no token scenario - action should do nothing
 */
export function mockNoToken<
  T extends { plugin: { settingsManager: { getGlobalSettings: jest.Mock } } },
>(action: T): void {
  action.plugin.settingsManager.getGlobalSettings = jest
    .fn()
    .mockReturnValue({} as GlobalSettingsInterface)
}

/**
 * Mock device missing a capability
 */
export function mockDeviceMissingCapability(
  deviceId: string,
  components?: DeviceStatus['components'],
) {
  return http.get(`https://api.smartthings.com/v1/devices/${deviceId}/status`, () => {
    return HttpResponse.json({
      components: components || {
        main: {},
      },
    })
  })
}

/**
 * Mock API error response
 */
export function mockApiError(
  deviceId: string,
  status: number = 401,
  error: string = 'Unauthorized',
) {
  return http.get(`https://api.smartthings.com/v1/devices/${deviceId}/status`, () => {
    return HttpResponse.json({ error }, { status })
  })
}

/**
 * Setup spies for alert and warning
 */
export function setupAlertSpies<T extends { plugin: { showAlert: () => void } }>(action: T) {
  const showAlert = jest.spyOn(action.plugin, 'showAlert').mockImplementation()
  const warn = jest.spyOn(console, 'warn').mockImplementation()

  return {
    showAlert,
    warn,
    restore: () => {
      showAlert.mockRestore()
      warn.mockRestore()
    },
  }
}

/**
 * Common test: action should not do anything without a token
 */
export async function testNoTokenEarlyReturn<
  T extends {
    plugin: { settingsManager: { getGlobalSettings: jest.Mock } }
    onKeyUp: (event: unknown) => Promise<void>
  },
>(action: T, keyUpEvent: unknown): Promise<void> {
  mockNoToken(action)
  const fetchSpy = jest.spyOn(window, 'fetch')

  await action.onKeyUp(keyUpEvent)

  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
}

/**
 * Common test: action should ignore events from wrong action UUID
 */
export async function testIgnoreWrongAction<
  T extends { onKeyUp: (event: unknown) => Promise<void> },
>(action: T, keyUpEvent: unknown): Promise<void> {
  const fetchSpy = jest.spyOn(window, 'fetch')

  await action.onKeyUp(keyUpEvent)

  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
}

/**
 * Common test: action should show alert when device lacks required capability
 */
export async function testMissingCapability<
  T extends { plugin: { showAlert: () => void }; onKeyUp: (event: unknown) => Promise<void> },
>(
  server: { use: (...handlers: unknown[]) => void },
  action: T,
  deviceId: string,
  keyUpEvent: unknown,
  expectedWarning: string,
  components?: DeviceStatus['components'],
): Promise<void> {
  server.use(mockDeviceMissingCapability(deviceId, components))

  const spies = setupAlertSpies(action)

  await action.onKeyUp(keyUpEvent)

  expect(spies.showAlert).toHaveBeenCalled()
  expect(spies.warn).toHaveBeenCalledWith(expectedWarning)

  spies.restore()
}

/**
 * Common test: action should handle API errors gracefully
 */
export async function testApiErrorHandling<
  T extends { onKeyUp: (event: unknown) => Promise<void> },
>(
  server: { use: (...handlers: unknown[]) => void },
  action: T,
  deviceId: string,
  keyUpEvent: unknown,
  spyOnPrivateMethod: <T, K extends string>(instance: T, methodName: K) => jest.SpyInstance,
): Promise<void> {
  server.use(mockApiError(deviceId))

  const handleError = spyOnPrivateMethod(action, 'handleError').mockImplementation()

  await action.onKeyUp(keyUpEvent)

  expect(handleError).toHaveBeenCalled()

  handleError.mockRestore()
}
