import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { GarageDoorAction } from '../garagedoor'
import { DeviceSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('GarageDoorAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const garageDoorAction = new GarageDoorAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.garagedoor'
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => ({
        accessToken: 'fakeToken',
      })
    })

    it('should open a closed garage door', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(
            ctx.json({
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
          )
        }),
        rest.post('https://api.smartthings.com/v1/devices/42/commands', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
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
        }
      )
    })

    it('should close an open garage door', async () => {
      server.use(
        rest.get('https://api.smartthings.com/v1/devices/42/status', (req, res, ctx) => {
          return res(
            ctx.json({
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
          )
        }),
        rest.post('https://api.smartthings.com/v1/devices/42/commands', (req, res, ctx) => {
          return res(ctx.json({}))
        })
      )

      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
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
        }
      )
    })

    it('should not do anything without a token', async () => {
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => ({
        accessToken: undefined,
      })

      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
      )

      expect(window.fetch).not.toHaveBeenCalled()
    })
  })
})
