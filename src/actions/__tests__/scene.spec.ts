import 'isomorphic-fetch'

import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'

import { SceneAction } from '../scene'
import { SceneSettingsInterface } from '../../utils/interface'
import { Smartthings } from '../../smartthings-plugin'
import { rest } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

describe('Test scene action', () => {
  beforeAll(() => server.listen())
  afterAll(() => server.close())

  const sceneAction = new SceneAction(
    new FakeStreamdeckApi() as Smartthings,
    'com.thibautsabot.streamdeck.scene'
  )

  describe('onKeyUp', () => {
    beforeEach(() => {
      jest.clearAllMocks()
      sceneAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: 'fakeToken' })
    })

    it('should execute a scene', async () => {
      server.use(
        rest.post('https://api.smartthings.com/v1/scenes/42/execute', (req, res, ctx) => {
          return res(ctx.json({}))
        }),
      )

      jest.spyOn(window, 'fetch')

      await sceneAction.onKeyUp(
        fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: '42' })
      )

      expect(window.fetch).toHaveBeenCalledWith(
        'https://api.smartthings.com/v1/scenes/42/execute',
        {
          method: 'POST',
          headers: expect.anything(),
        }
      )
    })

    it('should not do anything without a token', async () => {
      sceneAction.plugin.settingsManager.getGlobalSettings = () => ({ accessToken: undefined })

      const showAlert = jest.spyOn(sceneAction.plugin, 'showAlert').mockImplementation()
      jest.spyOn(window, 'fetch')

      await sceneAction.onKeyUp(
        fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: '42' })
      )

      expect(window.fetch).not.toHaveBeenCalled()
      expect(showAlert).toHaveBeenCalled()

      showAlert.mockRestore()
    })

    it('should show alert when sceneId is missing', async () => {
      const showAlert = jest.spyOn(sceneAction.plugin, 'showAlert').mockImplementation()
      jest.spyOn(window, 'fetch')

      await sceneAction.onKeyUp(
        fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: '' })
      )

      expect(window.fetch).not.toHaveBeenCalled()
      expect(showAlert).toHaveBeenCalled()

      showAlert.mockRestore()
    })

    it('should show success feedback when scene executes successfully', async () => {
      server.use(
        rest.post('https://api.smartthings.com/v1/scenes/42/execute', (req, res, ctx) => {
          return res(ctx.json({}))
        }),
      )

      const showOk = jest.spyOn(sceneAction.plugin, 'showOk').mockImplementation()

      await sceneAction.onKeyUp(
        fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: '42' })
      )

      expect(showOk).toHaveBeenCalled()

      showOk.mockRestore()
    })

    it('should handle errors when scene execution fails', async () => {
      server.use(
        rest.post('https://api.smartthings.com/v1/scenes/42/execute', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: 'Internal Server Error' }))
        }),
      )

      const showAlert = jest.spyOn(sceneAction.plugin, 'showAlert').mockImplementation()

      await sceneAction.onKeyUp(
        fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: '42' })
      )

      expect(showAlert).toHaveBeenCalled()

      showAlert.mockRestore()
    })
  })
})
