import { SmartThingsOAuthClient } from '../oauth-client'
import {
  getValidAccessToken,
  refreshAccessToken,
  forceRefreshAccessToken,
  isAuthRevoked,
} from '../token-manager'
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

describe('token-manager', () => {
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

  it('sends a single refresh request for concurrent callers', async () => {
    const settings = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })
    client.isTokenExpired.mockReturnValue(true)
    client.refreshToken.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(newTokens), 20)),
    )
    const save = jest.fn()

    const results = await Promise.all(
      Array.from({ length: 10 }, () => getValidAccessToken(settings, save)),
    )

    expect(client.refreshToken).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(results).toEqual(Array(10).fill('new-access'))
  })

  it('releases the lock after a failure so the next call can retry', async () => {
    const settings = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })
    client.isTokenExpired.mockReturnValue(true)
    client.refreshToken.mockRejectedValueOnce(new Error('network down'))
    client.refreshToken.mockResolvedValueOnce(newTokens)
    const save = jest.fn()

    expect(await getValidAccessToken(settings, save)).toBeNull()
    expect(await getValidAccessToken(settings, save)).toBe('new-access')
    expect(client.refreshToken).toHaveBeenCalledTimes(2)
  })

  it('uses the refresh token from the latest settings', async () => {
    const stale = createMockGlobalSettings({
      oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'stale-refresh' },
    })
    const latest = createMockGlobalSettings({
      oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'latest-refresh' },
    })
    client.isTokenExpired.mockReturnValue(true)
    client.refreshToken.mockResolvedValue(newTokens)

    await getValidAccessToken(stale, jest.fn(), () => latest)

    expect(client.refreshToken).toHaveBeenCalledWith('latest-refresh')
  })

  it('skips the request when the latest settings already hold a fresh token', async () => {
    const stale = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })
    const latest = createMockGlobalSettings({
      oauthTokens: { ...newTokens, accessToken: 'already-fresh' },
    })
    client.isTokenExpired.mockImplementation((t) => t === stale.oauthTokens)

    const result = await getValidAccessToken(stale, jest.fn(), () => latest)

    expect(result).toBe('already-fresh')
    expect(client.refreshToken).not.toHaveBeenCalled()
  })

  it('does not refresh a valid token', async () => {
    const settings = createMockGlobalSettings()
    client.isTokenExpired.mockReturnValue(false)

    expect(await getValidAccessToken(settings, jest.fn())).toBe('mock-access-token')
    expect(client.refreshToken).not.toHaveBeenCalled()
  })

  describe('forceRefreshAccessToken', () => {
    it('refreshes a token that looks valid but was rejected by the API', async () => {
      const settings = createMockGlobalSettings()
      client.isTokenExpired.mockReturnValue(false)
      client.refreshToken.mockResolvedValue(newTokens)

      const result = await forceRefreshAccessToken(settings, 'mock-access-token', jest.fn())

      expect(result).toBe('new-access')
      expect(client.refreshToken).toHaveBeenCalledWith('mock-refresh-token')
    })

    it('reuses the stored token if another caller already replaced the rejected one', async () => {
      const latest = createMockGlobalSettings({ oauthTokens: { ...newTokens } })
      client.isTokenExpired.mockReturnValue(false)

      const result = await forceRefreshAccessToken(
        createMockGlobalSettings(),
        'mock-access-token',
        jest.fn(),
        () => latest,
      )

      expect(result).toBe('new-access')
      expect(client.refreshToken).not.toHaveBeenCalled()
    })
  })

  describe('error reporting', () => {
    it('logs the SmartThings error and flags permanent rejections', async () => {
      const settings = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue({
        body: { error: 'invalid_grant', error_description: 'refresh token revoked' },
      })

      const result = await getValidAccessToken(settings, jest.fn())

      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        '[TokenManager] Token refresh failed (invalid_grant: refresh token revoked):',
        expect.anything(),
      )
      expect(isAuthRevoked(settings)).toBe(true)
    })

    it.each([400, 401])(
      'flags a bare HTTP %i from the token endpoint as permanent',
      async (status) => {
        const settings = createMockGlobalSettings({
          oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: `bare-http-${status}` },
        })
        client.isTokenExpired.mockReturnValue(true)
        client.refreshToken.mockRejectedValue({ code: 'ESTATUS', status })

        await getValidAccessToken(settings, jest.fn())

        expect(isAuthRevoked(settings)).toBe(true)
      },
    )

    it('does not flag HTTP 5xx as permanent', async () => {
      const settings = createMockGlobalSettings({
        oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'bare-http-503' },
      })
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue({ code: 'ESTATUS', status: 503 })

      await getValidAccessToken(settings, jest.fn())

      expect(isAuthRevoked(settings)).toBe(false)
    })

    it('does not flag temporary failures', async () => {
      const settings = createMockGlobalSettings({
        oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'temp-fail-token' },
      })
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue(new Error('timeout'))

      await getValidAccessToken(settings, jest.fn())

      expect(isAuthRevoked(settings)).toBe(false)
    })

    it('clears the revoked flag once a refresh succeeds', async () => {
      const settings = createMockGlobalSettings({
        oauthTokens: { ...createExpiredOAuthTokens(), refreshToken: 'revoked-then-ok' },
      })
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValueOnce({ body: { error: 'invalid_grant' } })
      await getValidAccessToken(settings, jest.fn())
      expect(isAuthRevoked(settings)).toBe(true)

      client.refreshToken.mockResolvedValueOnce(newTokens)
      await getValidAccessToken(settings, jest.fn())
      expect(isAuthRevoked(settings)).toBe(false)
    })

    it('handles errors without any detail', async () => {
      const settings = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })
      client.isTokenExpired.mockReturnValue(true)
      client.refreshToken.mockRejectedValue(undefined)

      expect(await getValidAccessToken(settings, jest.fn())).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        '[TokenManager] Token refresh failed (unknown error):',
        undefined,
      )
    })
  })

  it('refreshAccessToken works with an explicit client', async () => {
    client.isTokenExpired.mockReturnValue(true)
    client.refreshToken.mockResolvedValue(newTokens)
    const settings = createMockGlobalSettings({ oauthTokens: createExpiredOAuthTokens() })

    const result = await refreshAccessToken(
      settings,
      client as unknown as SmartThingsOAuthClient,
      jest.fn(),
    )

    expect(result).toBe('new-access')
  })
})
