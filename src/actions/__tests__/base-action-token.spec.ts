import 'isomorphic-fetch'
import { FakeStreamdeckApi } from '../../utils/fakeApi'
import { BaseAction } from '../base-action'
import { Smartthings } from '../../smartthings-plugin'
import { SmartThingsOAuthClient } from '../../utils/oauth-client'

// Mock the OAuth client
jest.mock('../../utils/oauth-client')

// Create a concrete test class
class TestAction extends BaseAction<TestAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }
}

type MockOAuthClient = {
  isTokenExpired: jest.Mock
  refreshToken: jest.Mock
  getAuthorizationUrl: jest.Mock
  exchangeCodeForToken: jest.Mock
}

describe('BaseAction Token Management', () => {
  let testAction: TestAction
  let fakePlugin: Smartthings
  let mockOAuthClient: MockOAuthClient

  beforeEach(() => {
    jest.clearAllMocks()
    fakePlugin = new FakeStreamdeckApi() as Smartthings
    testAction = new TestAction(fakePlugin, 'com.test.action')

    mockOAuthClient = {
      isTokenExpired: jest.fn(),
      refreshToken: jest.fn(),
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
    }

    ;(SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>).mockImplementation(
      () => mockOAuthClient as unknown as SmartThingsOAuthClient
    )
  })

  describe('getAccessToken', () => {
    it('should return null when no global settings', async () => {
      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue({})

      const result = await testAction['getAccessToken']()

      expect(result).toBeNull()
    })

    it('should return existing token when not expired', async () => {
      const mockSettings = {
        oauthTokens: {
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
        },
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      }

      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue(mockSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(false)

      const result = await testAction['getAccessToken']()

      expect(result).toBe('valid-token')
      expect(mockOAuthClient.refreshToken).not.toHaveBeenCalled()
    })

    it('should refresh expired token and save new tokens', async () => {
      const mockSettings = {
        oauthTokens: {
          accessToken: 'expired-token',
          refreshToken: 'refresh-token',
          expiresAt: Date.now() - 1000,
          tokenType: 'Bearer',
        },
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      }

      const newTokens = {
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      }

      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue(mockSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(true)
      mockOAuthClient.refreshToken.mockResolvedValue(newTokens)

      const setGlobalSettings = jest.spyOn(fakePlugin.settingsManager, 'setGlobalSettings')
      const consoleLog = jest.spyOn(console, 'log').mockImplementation()

      const result = await testAction['getAccessToken']()

      expect(result).toBe('new-token')
      expect(mockOAuthClient.refreshToken).toHaveBeenCalledWith('refresh-token')
      expect(setGlobalSettings).toHaveBeenCalledWith({
        ...mockSettings,
        oauthTokens: newTokens,
      })
      expect(consoleLog).toHaveBeenCalledWith('[OAuth] Token expired, refreshing...')
      expect(consoleLog).toHaveBeenCalledWith('[OAuth] Token refreshed successfully')

      consoleLog.mockRestore()
    })

    it('should return null when token refresh fails', async () => {
      const mockSettings = {
        oauthTokens: {
          accessToken: 'expired-token',
          refreshToken: 'invalid-refresh-token',
          expiresAt: Date.now() - 1000,
          tokenType: 'Bearer',
        },
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      }

      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue(mockSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(true)
      mockOAuthClient.refreshToken.mockRejectedValue(new Error('Invalid refresh token'))

      const consoleError = jest.spyOn(console, 'error').mockImplementation()

      const result = await testAction['getAccessToken']()

      expect(result).toBeNull()
      expect(consoleError).toHaveBeenCalledWith(
        '[OAuth] Failed to refresh token:',
        expect.any(Error)
      )

      consoleError.mockRestore()
    })
  })
})
