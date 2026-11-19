import { SmartThingsOAuthClient } from '../oauth-client'
import {
  getPluginAccessToken,
  refreshPluginAccessToken,
  isPluginAuthRevoked,
  handleTokenRequest,
  PluginLike,
} from '../plugin-token'
import { GlobalSettingsInterface } from '../interface'
import {
  createMockGlobalSettings,
  createExpiredOAuthTokens,
} from '../../test-helpers/oauth-fixtures'

jest.mock('../oauth-client')

type MockClient = { isTokenExpired: jest.Mock; refreshToken: jest.Mock }

const newTokens = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  expiresAt: Date.now() + 3600000,
  tokenType: 'Bearer',
}

function createPlugin(initial: Partial<GlobalSettingsInterface> | null) {
  let settings: unknown = initial ?? {}
  const plugin = {
    settingsManager: {
      getGlobalSettings: jest.fn(() => settings),
      setGlobalSettings: jest.fn((s: unknown) => {
        settings = s
      }),
    },
    sendToPropertyInspector: jest.fn(),
    requestGlobalSettings: jest.fn(),
  }
  return plugin as unknown as PluginLike & {
    settingsManager: { setGlobalSettings: jest.Mock }
    sendToPropertyInspector: jest.Mock
    requestGlobalSettings: jest.Mock
  }
}

describe('plugin-token', () => {
  let client: MockClient

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
    client = { isTokenExpired: jest.fn(), refreshToken: jest.fn() }
    ;(SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>).mockImplementation(
      () => client as unknown as SmartThingsOAuthClient,
    )
  })

  afterEach(() => jest.restoreAllMocks())

  describe('getPluginAccessToken', () => {
    it('returns null when not configured', async () => {
      expect(await getPluginAccessToken(createPlugin(null))).toBeNull()
    })

    it('saves refreshed tokens merged into the latest settings', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockResolvedValue(newTokens)

      const token = await getPluginAccessToken(plugin)

      expect(token).toBe('new-access')
      expect(plugin.settingsManager.setGlobalSettings).toHaveBeenCalledWith(
        expect.objectContaining({ oauthClientId: 'mock-client-id', oauthTokens: newTokens }),
      )
    })

    it('asks Stream Deck to confirm the save, so the log shows whether it stuck', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockResolvedValue(newTokens)

      await getPluginAccessToken(plugin)

      expect(plugin.requestGlobalSettings).toHaveBeenCalledTimes(1)
    })

    it('does not save if settings were cleared during the refresh (sign out)', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockImplementation(async () => {
        plugin.settingsManager.getGlobalSettings.mockReturnValue({})
        return newTokens
      })

      await getPluginAccessToken(plugin)

      expect(plugin.settingsManager.setGlobalSettings).not.toHaveBeenCalled()
    })
  })

  describe('refreshPluginAccessToken', () => {
    it('returns null when not configured', async () => {
      expect(await refreshPluginAccessToken(createPlugin(null), 'x')).toBeNull()
    })

    it('forces a refresh of a rejected token', async () => {
      const plugin = createPlugin(createMockGlobalSettings())
      client.isTokenExpired.mockReturnValue(false)
      client.refreshToken.mockResolvedValue(newTokens)

      expect(await refreshPluginAccessToken(plugin, 'mock-access-token')).toBe('new-access')
    })
  })

  describe('isPluginAuthRevoked', () => {
    it('is false when not configured', () => {
      expect(isPluginAuthRevoked(createPlugin(null))).toBe(false)
    })
  })

  describe('handleTokenRequest', () => {
    const event = (payload: unknown) => ({ action: 'act', context: 'ctx', payload }) as never

    it('ignores unrelated messages', async () => {
      const plugin = createPlugin(createMockGlobalSettings())

      await handleTokenRequest(plugin, event({ event: 'other' }))
      await handleTokenRequest(plugin, event(undefined))

      expect(plugin.sendToPropertyInspector).not.toHaveBeenCalled()
    })

    it('replies not_configured without settings', async () => {
      const plugin = createPlugin(null)

      await handleTokenRequest(plugin, event({ event: 'getToken', requestId: 'r1' }))

      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        { event: 'token', requestId: 'r1', error: 'not_configured' },
        'act',
        'ctx',
      )
    })

    it('replies with a valid token', async () => {
      const plugin = createPlugin(createMockGlobalSettings())
      client.isTokenExpired.mockReturnValue(false)

      await handleTokenRequest(plugin, event({ event: 'getToken', requestId: 'r2' }))

      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        { event: 'token', requestId: 'r2', accessToken: 'mock-access-token' },
        'act',
        'ctx',
      )
    })

    it('refreshes first when the token is expired', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockResolvedValue(newTokens)

      await handleTokenRequest(plugin, event({ event: 'getToken', requestId: 'r3' }))

      expect(client.refreshToken).toHaveBeenCalledTimes(1)
      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        expect.objectContaining({ accessToken: 'new-access' }),
        'act',
        'ctx',
      )
    })

    it('forces a refresh when the panel reports a rejected token', async () => {
      const plugin = createPlugin(createMockGlobalSettings())
      client.isTokenExpired.mockReturnValue(false)
      client.refreshToken.mockResolvedValue(newTokens)

      await handleTokenRequest(
        plugin,
        event({ event: 'getToken', requestId: 'r4', rejectedAccessToken: 'mock-access-token' }),
      )

      expect(client.refreshToken).toHaveBeenCalledTimes(1)
    })

    it('replies refresh_failed on a temporary failure', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({
          oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'temp-token' },
        }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue(new Error('offline'))

      await handleTokenRequest(plugin, event({ event: 'getToken', requestId: 'r5' }))

      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        { event: 'token', requestId: 'r5', error: 'refresh_failed' },
        'act',
        'ctx',
      )
    })

    it('replies auth_revoked when SmartThings rejects the refresh token', async () => {
      const plugin = createPlugin(
        createMockGlobalSettings({
          oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'revoked-token' },
        }),
      )
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue({ body: { error: 'invalid_grant' } })

      await handleTokenRequest(plugin, event({ event: 'getToken', requestId: 'r6' }))

      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        { event: 'token', requestId: 'r6', error: 'auth_revoked' },
        'act',
        'ctx',
      )
      expect(isPluginAuthRevoked(plugin)).toBe(true)
    })

    it('uses an empty requestId when none is given', async () => {
      const plugin = createPlugin(null)

      await handleTokenRequest(plugin, event({ event: 'getToken' }))

      expect(plugin.sendToPropertyInspector).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: '' }),
        'act',
        'ctx',
      )
    })
  })
})
