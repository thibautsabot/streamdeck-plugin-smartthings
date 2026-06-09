import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent, fakeWillAppearEvent } from '../../utils/fakeApi'

import { GarageDoorAction } from '../garagedoor'
import { DeviceSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('GarageDoorAction', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const garageDoorAction = new GarageDoorAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.garagedoor',
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

      await garageDoorAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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

      await garageDoorAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => ({
        accessToken: undefined,
      })

      jest.spyOn(window, 'fetch')

      await garageDoorAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

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

      await garageDoorAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }))

      expect(showAlert).toHaveBeenCalled()
      expect(warn).toHaveBeenCalledWith('[GarageDoor] Device 42 missing doorControl capability')

      showAlert.mockRestore()
      warn.mockRestore()
    })
  })

  describe('updateDeviceState - intermediate states', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      garageDoorAction.plugin.settingsManager.getGlobalSettings = () => ({
        accessToken: 'fakeToken',
      })
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
        fakeWillAppearEvent<DeviceSettingsInterface>({ deviceId: '42' }),
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
        fakeWillAppearEvent<DeviceSettingsInterface>({ deviceId: '42' }),
      )

      expect(setState).toHaveBeenCalledWith(0, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('⬇️ CLOSING', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
    })

    it('should display UNKNOWN state with title', async () => {
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

      const setState = jest.spyOn(garageDoorAction.plugin, 'setState').mockImplementation()
      const setTitle = jest.spyOn(garageDoorAction.plugin, 'setTitle').mockImplementation()

      await garageDoorAction.onWillAppear(
        fakeWillAppearEvent<DeviceSettingsInterface>({ deviceId: '42' }),
      )

      expect(setState).toHaveBeenCalledWith(0, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('❓ UNKNOWN', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
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
        fakeWillAppearEvent<DeviceSettingsInterface>({ deviceId: '42' }),
      )

      expect(setState).toHaveBeenCalledWith(1, expect.anything())
      expect(setTitle).toHaveBeenCalledWith('', expect.anything())

      setState.mockRestore()
      setTitle.mockRestore()
    })
  })
})
