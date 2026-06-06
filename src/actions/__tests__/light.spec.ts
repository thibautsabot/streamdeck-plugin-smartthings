import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { LightAction } from '../light'
import { DeviceSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('LightAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const lightAction = new LightAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.light'
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      lightAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: 'fakeToken' })
    })

    it('should toggle light on', async () => {
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
                  switchLevel: {
                    level: {
                      value: 50,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
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

    it('should toggle light off', async () => {
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
                  switchLevel: {
                    level: {
                      value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
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

    it('should make light brighter', async () => {
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
                  switchLevel: {
                    level: {
                      value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.MORE })
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
        }
      )
    })

    it('should make light darker', async () => {
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
                  switchLevel: {
                    level: {
                      value: 70,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.LESS })
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
        }
      )
    })

    it('should cap brightness at 100', async () => {
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
                  switchLevel: {
                    level: {
                      value: 95,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.MORE })
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
        }
      )
    })

    it('should cap brightness at 0', async () => {
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
                  switchLevel: {
                    level: {
                      value: 5,
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

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: LightBehavior.LESS })
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
        }
      )
    })

    it('should not do anything without a token', async () => {
      lightAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: undefined })

      jest.spyOn(window, 'fetch')

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
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

      const showAlert = jest.spyOn(lightAction.plugin, 'showAlert').mockImplementation()
      const warn = jest.spyOn(console, 'warn').mockImplementation()

      await lightAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42', behaviour: 'toggle' })
      )

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[Light] Device 42 missing switch capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })
  })
})
