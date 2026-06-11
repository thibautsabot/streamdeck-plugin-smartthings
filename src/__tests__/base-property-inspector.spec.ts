import 'isomorphic-fetch'
import { BasePropertyInspector } from '../base-property-inspector'
import { GlobalSettingsInterface } from '../utils/interface'
import { SmartThingsOAuthClient } from '../utils/oauth-client'

// Mock the OAuth client
jest.mock('../utils/oauth-client')

// Create a concrete test class since BasePropertyInspector is abstract
class TestPropertyInspector extends BasePropertyInspector<any> {
  public mockSettingsManager = {
    setGlobalSettings: jest.fn(),
    getGlobalSettings: jest.fn(),
  }

  // Override the readonly settingsManager property
  get settingsManager(): any {
    return this.mockSettingsManager
  }

  protected getDefaultOptionLabel(): string {
    return 'No device selected'
  }

  protected async fetchOptions(accessToken: string): Promise<any[]> {
    return []
  }

  protected saveSettings(): void {}

  onReceiveSettings(event: any): void {}
}

describe('BasePropertyInspector Token Refresh', () => {
  let inspector: TestPropertyInspector
  let mockOAuthClient: jest.Mocked<SmartThingsOAuthClient>

  const validGlobalSettings: GlobalSettingsInterface = {
    oauthTokens: {
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
      tokenType: 'Bearer',
    },
    oauthClientId: 'test-client-id',
    oauthClientSecret: 'test-client-secret',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    inspector = new TestPropertyInspector()

    // Setup mock OAuth client
    mockOAuthClient = {
      isTokenExpired: jest.fn(),
      refreshToken: jest.fn(),
    } as any

    ;(SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>).mockImplementation(
      () => mockOAuthClient
    )
  })

  describe('getAccessToken', () => {
    it('should return existing token when not expired', async () => {
      mockOAuthClient.isTokenExpired.mockReturnValue(false)

      const result = await inspector['getAccessToken'](validGlobalSettings)

      expect(result).toBe('valid-access-token')
      expect(mockOAuthClient.isTokenExpired).toHaveBeenCalledWith(validGlobalSettings.oauthTokens)
      expect(mockOAuthClient.refreshToken).not.toHaveBeenCalled()
    })

    it('should refresh token when expired', async () => {
      mockOAuthClient.isTokenExpired.mockReturnValue(true)
      mockOAuthClient.refreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      })

      const result = await inspector['getAccessToken'](validGlobalSettings)

      expect(result).toBe('new-access-token')
      expect(mockOAuthClient.refreshToken).toHaveBeenCalledWith('valid-refresh-token')
      expect(inspector.mockSettingsManager.setGlobalSettings).toHaveBeenCalledWith({
        ...validGlobalSettings,
        oauthTokens: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresAt: expect.any(Number),
          tokenType: 'Bearer',
        },
      })
    })

    it('should return null when token refresh fails', async () => {
      mockOAuthClient.isTokenExpired.mockReturnValue(true)
      mockOAuthClient.refreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      const consoleError = jest.spyOn(console, 'error').mockImplementation()

      const result = await inspector['getAccessToken'](validGlobalSettings)

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        '[PropertyInspector] Token refresh failed:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })
  })

  describe('refreshAccessToken', () => {
    it('should successfully refresh token', async () => {
      const newTokens = {
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      }

      mockOAuthClient.refreshToken.mockResolvedValue(newTokens)

      const result = await inspector['refreshAccessToken'](validGlobalSettings, mockOAuthClient)

      expect(result).toBe('refreshed-access-token')
      expect(mockOAuthClient.refreshToken).toHaveBeenCalledWith('valid-refresh-token')
      expect(inspector.mockSettingsManager.setGlobalSettings).toHaveBeenCalledWith({
        ...validGlobalSettings,
        oauthTokens: newTokens,
      })
    })

    it('should return null and log error when refresh fails', async () => {
      const error = new Error('Network error')
      mockOAuthClient.refreshToken.mockRejectedValue(error)

      const consoleError = jest.spyOn(console, 'error').mockImplementation()

      const result = await inspector['refreshAccessToken'](validGlobalSettings, mockOAuthClient)

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith('[PropertyInspector] Token refresh failed:', error)

      consoleError.mockRestore()
    })
  })
})
