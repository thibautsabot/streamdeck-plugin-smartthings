import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { DeviceAction } from '../device'
import { DeviceSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('Test device action', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const deviceAction = new DeviceAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.device'
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      deviceAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: 'fakeToken' })
    })

    it('should warn that only switches are supported', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await deviceAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
      )

      expect(warn).toBeCalledWith('Only switch devices are supported at the moment !')
      warn.mockReset()
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

      await deviceAction.onKeyUp(
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

      await deviceAction.onKeyUp(
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
      deviceAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: undefined })

      jest.spyOn(window, 'fetch')

      await deviceAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' })
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })
  })
})
