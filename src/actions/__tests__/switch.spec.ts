import 'isomorphic-fetch'
import { createMockGlobalSettings } from '../../test-helpers/oauth-fixtures'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { SwitchAction } from '../switch'
import { DeviceSettingsInterface, GlobalSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

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

      await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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

      await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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

      await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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

      await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[Switch] Device 42 missing switch capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })
  })
})
