import 'isomorphic-fetch'
import { createMockGlobalSettings } from '../../test-helpers/oauth-fixtures'

import { FakeStreamdeckApi, fakeKeyUpEvent, spyOnPrivateMethod } from '../../utils/fakeApi'

import { LightAction } from '../light'
import { LightSettingsInterface, GlobalSettingsInterface } from '../../utils/interface'
import { LightBehavior } from '../../utils/smartthings-types'
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

describe('LightAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const lightAction = new LightAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.light',
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      lightAction.plugin.settingsManager.getGlobalSettings = () => (createMockGlobalSettings())
    })

    it('should toggle light on', async () => {
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
                switchLevel: {
                  level: {
                    value: 50,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.TOGGLE }, 'com.thibautsabot.streamdeck.light'),
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

    it('should toggle light off', async () => {
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
                switchLevel: {
                  level: {
                    value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.TOGGLE }, 'com.thibautsabot.streamdeck.light'),
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

    it('should make light brighter', async () => {
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
                switchLevel: {
                  level: {
                    value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.MORE }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switchLevel',
              command: 'setLevel',
              arguments: [80],
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should make light darker', async () => {
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
                switchLevel: {
                  level: {
                    value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.LESS }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switchLevel',
              command: 'setLevel',
              arguments: [60],
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should cap brightness at 100', async () => {
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
                switchLevel: {
                  level: {
                    value: 95,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.MORE }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switchLevel',
              command: 'setLevel',
              arguments: [100],
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should cap brightness at 0', async () => {
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
                switchLevel: {
                  level: {
                    value: 5,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.LESS }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(window.fetch).toHaveBeenLastCalledWith(
        'https://api.smartthings.com/v1/devices/42/commands',
        {
          body: JSON.stringify([
            {
              capability: 'switchLevel',
              command: 'setLevel',
              arguments: [0],
            },
          ]),
          method: 'POST',
          headers: expect.anything(),
        },
      )
    })

    it('should not do anything without a token', async () => {
      lightAction.plugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.TOGGLE }, 'com.thibautsabot.streamdeck.light'),
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

      const showAlert = jest.spyOn(lightAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.TOGGLE }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[Light] Device 42 missing switch capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })

    it('should show alert when device lacks switchLevel for MORE behavior', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: { switch: { value: 'on' } },
                // No switchLevel capability
              },
            },
          })
        }),
      )

      const showAlert = jest.spyOn(lightAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.MORE }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(
        "[Light] Device 42 doesn't support dimming - use Switch action instead",
      )

      showAlert.mockRestore()
      warn.mockRestore()
    })

    it('should show alert when device lacks switchLevel for LESS behavior', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({
            components: {
              main: {
                switch: { switch: { value: 'on' } },
                // No switchLevel capability
              },
            },
          })
        }),
      )

      const showAlert = jest.spyOn(lightAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.LESS }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith(
        "[Light] Device 42 doesn't support dimming - use Switch action instead",
      )

      showAlert.mockRestore()
      warn.mockRestore()
    })

    it('should ignore keyUp events from wrong action', async () => {
      jest.spyOn(window, 'fetch')

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>(
          { deviceId: '42', behaviour: LightBehavior.TOGGLE },
          'com.other.action',
        ),
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should handle API errors gracefully', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }),
      )

      const handleError = spyOnPrivateMethod(lightAction, 'handleError').mockImplementation()

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.TOGGLE }, 'com.thibautsabot.streamdeck.light'),
      )

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })
  })

  describe('updateDeviceState', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      lightAction.plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
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

      const setState = jest.spyOn(lightAction.plugin, 'setState').mockImplementation()

      await lightAction['updateDeviceState']('test-context', { deviceId: '42' })

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

      const setState = jest.spyOn(lightAction.plugin, 'setState').mockImplementation()

      await lightAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(setState).toHaveBeenCalledWith(0, 'test-context')

      setState.mockRestore()
    })

    it('should return early when no deviceId', async () => {
      jest.spyOn(window, 'fetch')

      await lightAction['updateDeviceState']('test-context', {} as LightSettingsInterface)

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should return early when no access token', async () => {
      lightAction.plugin.settingsManager.getGlobalSettings = jest
        .fn()
        .mockReturnValue({} as GlobalSettingsInterface)

      jest.spyOn(window, 'fetch')

      await lightAction['updateDeviceState']('test-context', { deviceId: '42' })

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

      await lightAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(warn).toHaveBeenCalledWith('[Light] Device 42 missing switch capability')

      warn.mockRestore()
    })

    it('should handle errors in updateDeviceState', async () => {
      server.use(
        http.get('https://api.smartthings.com/v1/devices/42/status', () => {
          return HttpResponse.json({ error: 'Server error' }, { status: 500 })
        }),
      )

      const handleError = spyOnPrivateMethod(lightAction, 'handleError').mockImplementation()

      await lightAction['updateDeviceState']('test-context', { deviceId: '42' })

      expect(handleError).toHaveBeenCalled()

      handleError.mockRestore()
    })

    it('should default to TOGGLE behavior when behaviour is undefined', async () => {
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<LightSettingsInterface>({ deviceId: '42' }, 'com.thibautsabot.streamdeck.light'),
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
  })
})
