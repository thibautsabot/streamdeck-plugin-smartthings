import 'isomorphic-fetch'
import { createMockGlobalSettings } from '../../test-helpers/oauth-fixtures'

import { FakeStreamdeckApi, fakeKeyUpEvent, spyOnPrivateMethod } from '../../utils/fakeApi'

import { SwitchAction } from '../switch'
import { DeviceSettingsInterface, GlobalSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Mock the OAuth client
jest.mock('../../utils/oauth-client', () => ({
  SmartThingsOAuthClient: jest.fn().mockImplementation(() => ({
    isTokenExpired: jest.fn().mockReturnValue(false),
    refreshToken: jest.fn(),
  })),
}))

const server = setupServer()

describe('SwitchAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const switchAction = new SwitchAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.switch',
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      switchAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
    })

    it('should turn on a switch', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: {
                  switch: {
                    value: 'off',
                  },
                },
              },
            },
          })
        }),
        http.post('https://api.smartthings.com/v1/devices/42/commands', () => {
          return HttpResponse.json({})
        }),
      )

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.switch',
        ),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switch',
              command: 'on',
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should turn off a switch', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: {
                  switch: {
                    value: 'on',
                  },
                },
              },
            },
          })
        }),
        http.post('https://api.smartthings.com/v1/devices/42/commands', () => {
          return HttpResponse.json({})
        }),
      )

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.switch',
        ),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switch',
              command: 'off',
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should not do anything without a token', async () => {
      switchAction.plugin.settingsManager.getGlobalSettings = jest
        .fn()
        .mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.switch',
        ),
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should show alert when device lacks switch capability', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                // No switch capability
              },
            },
          })
        }),
      )

      const showAlert = jest.spyOn(switchAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.switch',
        ),
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[Switch] Device 42 missing switch capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })

    it('should ignore keyUp events from wrong action', async () => {
      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, 'com.other.action'),
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }),
      )

      const handleError = spyOnPrivateMethod(switchAction, 'handleError').mockImplementation()

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.switch',
        ),
      )

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })
  })

  describe('updateDeviceState', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      switchAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
    })

    it('should update button state to ON', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: { switch: { value: 'on' } },
              },
            },
          })
        }),
      )

      const setState = jest.spyOn(switchAction.plugin, 'setState').mockImplementation()

      await switchAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(setState).toHaveBeenCalledWith(1, 'test-context')

      setState.mockRestore()
    })

    it('should update button state to OFF', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: { switch: { value: 'off' } },
              },
            },
          })
        }),
      )

      const setState = jest.spyOn(switchAction.plugin, 'setState').mockImplementation()

      await switchAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(setState).toHaveBeenCalledWith(0, 'test-context')

      setState.mockRestore()
    })

    it('should return early when no deviceId', async () => {
      jest.spyOn(window, 'fetch')

      await switchAction['updateDeviceState']('test-context', {} as DeviceSettingsInterface)

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should return early when no access token', async () => {
      switchAction.plugin.settingsManager.getGlobalSettings = jest
        .fn()
        .mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await switchAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should warn when device missing switch capability', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: { main: {} },
          })
        }),
      )

      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await switchAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(warn).toHaveBeenCalledWith('[Switch] Device 42 missing switch capability')

      warn.mockRestore()
    })

    it('should handle errors in updateDeviceState', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        }),
      )

      const handleError = spyOnPrivateMethod(switchAction, 'handleError').mockImplementation()

      await switchAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })
  })
})
