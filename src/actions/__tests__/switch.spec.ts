import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { SwitchAction } from '../switch'
import { DeviceSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('SwitchAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const switchAction = new SwitchAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.switch'
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      switchAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: 'fakeToken' })
    })

    it('should turn on a switch', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(
            ctx.json({
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
          )
        }),
        rest.post('https://api.smartthings.com/v1/devices/42/commands', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
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
        }
      )
    })

    it('should turn off a switch', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(
            ctx.json({
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
          )
        }),
        rest.post('https://api.smartthings.com/v1/devices/42/commands', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
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
        }
      )
    })

    it('should not do anything without a token', async () => {
      switchAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: undefined })

      jest.spyOn(window, 'fetch')

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })

    it('should show alert when device lacks switch capability', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(
            ctx.json({
              components: {
                main: {
                  // No switch capability
                },
              },
            })
          )
        })
      )

      const showAlert = jest.spyOn(switchAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[Switch] Device 42 missing switch capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })
  })
})
