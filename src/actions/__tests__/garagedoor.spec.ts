import 'isomorphic-fetch'
import { createMockGlobalSettings } from '../../test-helpers/oauth-fixtures'

import {
  FakeStreamdeckApi,
  fakeKeyUpEvent,
  fakeWillAppearEvent,
  spyOnPrivateMethod,
} from '../../utils/fakeApi'

import { GarageDoorAction } from '../garagedoor'
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

describe('GarageDoorAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const garageDoorAction = new GarageDoorAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.smartthings.garagedoor',
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
    })

    it('should open a closed garage door', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'closed',
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

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'doorControl',
              command: 'open',
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should close an open garage door', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'open',
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

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'doorControl',
              command: 'close',
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should not do anything without a token', async () => {
      garageDoorAction.plugin.settingsManager.getGlobalSettings = jest
        .fn()
        .mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should show alert when device lacks doorControl capability', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                // No doorControl capability
              },
            },
          })
        }),
      )

      const showAlert = jest.spyOn(garageDoorAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[GarageDoor] Device 42 missing doorControl capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })

    it('should ignore keyUp events from wrong action', async () => {
      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(
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

      const handleError = spyOnPrivateMethod(garageDoorAction, 'handleError').mockImplementation()

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })
  })

  describe('updateDeviceState - intermediate states', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
    })

    it('should display OPENING state with title', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'opening',
                  },
                },
              },
            },
          })
        }),
      )

      const setState = jest.spyOn(garageDoorAction.plugin, 'setState').mockImplementation()
      const setTitle = jest.spyOn(garageDoorAction.plugin, 'setTitle').mockImplementation()

      await garageDoorAction.onWillAppear(
        fakeWillAppearEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(setState).toHaveBeenCalledWith(1, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('⬆️ OPENING', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
    })

    it('should display CLOSING state with title', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'closing',
                  },
                },
              },
            },
          })
        }),
      )

      const setState = jest.spyOn(garageDoorAction.plugin, 'setState').mockImplementation()
      const setTitle = jest.spyOn(garageDoorAction.plugin, 'setTitle').mockImplementation()

      await garageDoorAction.onWillAppear(
        fakeWillAppearEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(setState).toHaveBeenCalledWith(0, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('⬇️ CLOSING', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
    })

    it('should warn and return early for unknown door state', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'unknown',
                  },
                },
              },
            },
          })
        }),
      )

      const warn = jest.spyOn(console, 'warn').mockImplementation()
      const setState = jest.spyOn(garageDoorAction.plugin, 'setState').mockImplementation()

      await garageDoorAction.onWillAppear(
        fakeWillAppearEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(warn).toHaveBeenCalledWith('[GarageDoor] Device 42 missing doorControl capability')
      expect(setState).not.toHaveBeenCalled()

      warn.mockRestore()
      setState.mockRestore()
    })

    it('should clear title for stable states (OPEN/CLOSED)', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                doorControl: {
                  door: {
                    value: 'open',
                  },
                },
              },
            },
          })
        }),
      )

      const setState = jest.spyOn(garageDoorAction.plugin, 'setState').mockImplementation()
      const setTitle = jest.spyOn(garageDoorAction.plugin, 'setTitle').mockImplementation()

      await garageDoorAction.onWillAppear(
        fakeWillAppearEvent<DeviceSettingsInterface>(
          { deviceId: '42' },
          'com.thibautsabot.streamdeck.smartthings.garagedoor',
        ),
      )

      expect(setState).toHaveBeenCalledWith(1, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
    })

    it('should return early when no deviceId', async () => {
      jest.spyOn(window, 'fetch')

      await garageDoorAction['updateDeviceState']('test-context', {} as DeviceSettingsInterface)

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should return early when no access token', async () => {
      garageDoorAction.plugin.settingsManager.getGlobalSettings = jest
        .fn()
        .mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await garageDoorAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should warn when device missing doorControl capability in updateDeviceState', async () => {
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()

      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: { main: {} },
          })
        }),
      )

      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await garageDoorAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(warn).toHaveBeenCalledWith('[GarageDoor] Device 42 missing doorControl capability')

      warn.mockRestore()
    })

    it('should handle errors in updateDeviceState', async () => {
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()

      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        }),
      )

      const handleError = spyOnPrivateMethod(garageDoorAction, 'handleError').mockImplementation()

      await garageDoorAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })
  })
})
