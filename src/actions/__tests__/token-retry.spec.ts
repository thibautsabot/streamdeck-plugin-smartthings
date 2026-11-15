import 'isomorphic-fetch'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { createMockGlobalSettings } from '../../test-helpers/oauth-fixtures'
import { FakeStreamdeckApi, fakeKeyUpEvent } from '../../utils/fakeApi'
import { SwitchAction } from '../switch'
import { SceneAction } from '../scene'
import { Smartthings } from '../../smartthings-plugin'
import { SmartThingsOAuthClient } from '../../utils/oauth-client'
import { DeviceSettingsInterface, SceneSettingsInterface } from '../../utils/interface'

jest.mock('../../utils/oauth-client')

const server = setupServer()

const newTokens = {
  accessToken: 'refreshed-token',
  refreshToken: 'refreshed-refresh',
  expiresAt: Date.now() + 3600000,
  tokenType: 'Bearer',
}

const SWITCH = 'com.thibautsabot.streamdeck.smartthings.switch'
const SCENE = 'com.thibautsabot.streamdeck.smartthings.scene'
const statusUrl = 'https://api.smartthings.com/v1/devices/42/status'
const commandsUrl = 'https://api.smartthings.com/v1/devices/42/commands'

describe('401 retry and sign-in feedback', () => {
  let refreshToken: jest.Mock
  let plugin: Smartthings
  let switchAction: SwitchAction
  let sceneAction: SceneAction

  beforeAll(() => server.listen())
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    refreshToken = jest.fn()
    ;(SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>).mockImplementation(
      () =>
        ({
          isTokenExpired: jest.fn().mockReturnValue(false),
          refreshToken,
        }) as unknown as SmartThingsOAuthClient,
    )

    plugin = new FakeStreamdeckApi() as Smartthings
    plugin.settingsManager.getGlobalSettings = () => createMockGlobalSettings()
    switchAction = new SwitchAction(plugin, SWITCH)
    sceneAction = new SceneAction(plugin, SCENE)
  })

  afterEach(() => jest.restoreAllMocks())

  it('refreshes once and retries the call after a 401', async () => {
    refreshToken.mockResolvedValue(newTokens)
    const seenTokens: string[] = []
    server.use(
      http.get(statusUrl, ({ request }) => {
        const auth = request.headers.get('Authorization') as string
        seenTokens.push(auth)
        if (auth === 'Bearer mock-access-token') {
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return HttpResponse.json({ components: { main: { switch: { switch: { value: 'off' } } } } })
      }),
      http.post(commandsUrl, () => HttpResponse.json({})),
    )

    await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, SWITCH))

    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(seenTokens).toEqual(['Bearer mock-access-token', 'Bearer refreshed-token'])
  })

  it('gives up after one retry when the second call is also a 401', async () => {
    refreshToken.mockResolvedValue(newTokens)
    let calls = 0
    server.use(
      http.get(statusUrl, () => {
        calls++
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }),
    )
    const showAlert = jest.spyOn(plugin, 'showAlert').mockImplementation()

    await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, SWITCH))

    expect(calls).toBe(2)
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(showAlert).toHaveBeenCalled()
  })

  it('does not retry errors other than 401', async () => {
    let calls = 0
    server.use(
      http.get(statusUrl, () => {
        calls++
        return HttpResponse.json({ error: 'boom' }, { status: 500 })
      }),
    )

    await switchAction.onKeyUp(fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, SWITCH))

    expect(calls).toBe(1)
    expect(refreshToken).not.toHaveBeenCalled()
  })

  it('retries scene execution after a 401', async () => {
    refreshToken.mockResolvedValue(newTokens)
    const seenTokens: string[] = []
    server.use(
      http.post('https://api.smartthings.com/v1/scenes/s1/execute', ({ request }) => {
        const auth = request.headers.get('Authorization') as string
        seenTokens.push(auth)
        return auth === 'Bearer refreshed-token'
          ? HttpResponse.json({ status: 'success' })
          : HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }),
    )
    const showOk = jest.spyOn(plugin, 'showOk').mockImplementation()

    await sceneAction.onKeyUp(fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: 's1' }, SCENE))

    expect(seenTokens).toEqual(['Bearer mock-access-token', 'Bearer refreshed-token'])
    expect(showOk).toHaveBeenCalled()
  })

  describe('SIGN IN title', () => {
    const expired = () =>
      createMockGlobalSettings({
        oauthTokens: {
          accessToken: 'old',
          refreshToken: 'revoked-refresh-token',
          expiresAt: Date.now() - 1000,
          tokenType: 'Bearer',
        },
      })

    beforeEach(() => {
      ;(
        SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>
      ).mockImplementation(
        () =>
          ({
            isTokenExpired: jest.fn().mockReturnValue(true),
            refreshToken,
          }) as unknown as SmartThingsOAuthClient,
      )
      plugin.settingsManager.getGlobalSettings = expired
    })

    it('is shown when SmartThings revoked the session', async () => {
      refreshToken.mockRejectedValue({ body: { error: 'invalid_grant' } })
      const setTitle = jest.spyOn(plugin, 'setTitle').mockImplementation()

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, SWITCH),
      )

      expect(setTitle).toHaveBeenCalledWith('⚠️ SIGN IN', '')
    })

    it('is not shown for a temporary failure', async () => {
      plugin.settingsManager.getGlobalSettings = () =>
        createMockGlobalSettings({
          oauthTokens: {
            accessToken: 'old',
            refreshToken: 'temporary-failure-token',
            expiresAt: Date.now() - 1000,
            tokenType: 'Bearer',
          },
        })
      refreshToken.mockRejectedValue(new Error('network down'))
      const setTitle = jest.spyOn(plugin, 'setTitle').mockImplementation()

      await switchAction.onKeyUp(
        fakeKeyUpEvent<DeviceSettingsInterface>({ deviceId: '42' }, SWITCH),
      )

      expect(setTitle).not.toHaveBeenCalled()
    })

    it('is shown for scenes too', async () => {
      refreshToken.mockRejectedValue({ body: { error: 'invalid_grant' } })
      const setTitle = jest.spyOn(plugin, 'setTitle').mockImplementation()
      jest.spyOn(plugin, 'showAlert').mockImplementation()

      await sceneAction.onKeyUp(fakeKeyUpEvent<SceneSettingsInterface>({ sceneId: 's1' }, SCENE))

      expect(setTitle).toHaveBeenCalledWith('⚠️ SIGN IN', '')
    })
  })
})
