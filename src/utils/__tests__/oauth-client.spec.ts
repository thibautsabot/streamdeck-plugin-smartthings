import 'isomorphic-fetch'
import { SmartThingsOAuthClient, OAuthTokens } from '../oauth-client'

// Create mock functions that will be shared across tests
const mockGetUri = jest.fn()
const mockGetToken = jest.fn()
const mockCreateToken = jest.fn()
const mockRefresh = jest.fn()

interface PKCEResult {
  verifier: string
  challenge: string
}

// Mock oauth-pkce
jest.mock('oauth-pkce', () => {
  return jest.fn((length: number, callback: (error: Error | null, result: PKCEResult) => void) => {
    callback(null, {
      verifier: 'mock-verifier-1234567890',
      challenge: 'mock-challenge-abcdef',
    })
  })
})

// Mock client-oauth2
jest.mock('client-oauth2', () => {
  return jest.fn().mockImplementation(() => ({
    code: {
      getUri: mockGetUri,
      getToken: mockGetToken,
    },
    createToken: mockCreateToken,
  }))
})

describe('SmartThingsOAuthClient', () => {
  let client: SmartThingsOAuthClient
  const clientId = 'test-client-id'
  const clientSecret = 'test-client-secret'

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mock implementations
    mockGetUri.mockImplementation(
      (options: {
        state: string
        query: { code_challenge: string; code_challenge_method: string }
      }) => {
        const params = new URLSearchParams({
          client_id: 'test-client-id',
          redirect_uri: 'https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html',
          state: options.state,
          code_challenge: options.query.code_challenge,
          code_challenge_method: options.query.code_challenge_method,
        })
        return `https://api.smartthings.com/oauth/authorize?${params.toString()}`
      },
    )

    client = new SmartThingsOAuthClient(clientId, clientSecret)
  })

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with PKCE parameters', async () => {
      const result = await client.getAuthorizationUrl()

      expect(result.url).toContain('https://api.smartthings.com/oauth/authorize')
      expect(result.url).toContain('code_challenge=mock-challenge-abcdef')
      expect(result.url).toContain('code_challenge_method=S256')
      expect(result.codeVerifier).toBe('mock-verifier-1234567890')
      expect(result.state).toBeDefined()
      expect(result.state.length).toBeGreaterThan(0)
    })

    it('should generate unique state parameter', async () => {
      const result1 = await client.getAuthorizationUrl()
      const result2 = await client.getAuthorizationUrl()

      expect(result1.state).not.toBe(result2.state)
    })
  })

  describe('exchangeCodeForToken', () => {
    it('should exchange authorization code for tokens', async () => {
      const mockToken = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        tokenType: 'Bearer',
        data: {
          expires_in: 3600,
        },
      }

      mockGetToken.mockResolvedValue(mockToken)

      const result = await client.exchangeCodeForToken('auth-code-123', 'verifier-123')

      expect(mockGetToken).toHaveBeenCalledWith(
        'https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html?code=auth-code-123',
        {
          body: {
            code_verifier: 'verifier-123',
          },
        },
      )

      expect(result.accessToken).toBe('access-token-123')
      expect(result.refreshToken).toBe('refresh-token-456')
      expect(result.tokenType).toBe('Bearer')
      expect(result.expiresAt).toBeGreaterThan(Date.now())
    })

    it('should throw error when token exchange fails', async () => {
      const error: Error & { body?: { error_description: string } } = new Error('Invalid grant')
      error.body = { error_description: 'Authorization code is invalid' }
      mockGetToken.mockRejectedValue(error)

      await expect(client.exchangeCodeForToken('invalid-code', 'verifier-123')).rejects.toThrow(
        'Authorization code is invalid',
      )
    })
  })

  describe('refreshToken', () => {
    it('should refresh access token using refresh token', async () => {
      const mockRefreshedToken = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        tokenType: 'Bearer',
        data: {
          expires_in: 3600,
        },
      }

      mockRefresh.mockResolvedValue(mockRefreshedToken)
      mockCreateToken.mockReturnValue({
        refresh: mockRefresh,
      })

      const result = await client.refreshToken('old-refresh-token')

      expect(mockCreateToken).toHaveBeenCalledWith({
        refresh_token: 'old-refresh-token',
      })
      expect(mockRefresh).toHaveBeenCalled()
      expect(result.accessToken).toBe('new-access-token')
      expect(result.refreshToken).toBe('new-refresh-token')
    })
  })

  describe('convertToken edge cases', () => {
    it('should handle token without expires_in', async () => {
      const mockToken = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        tokenType: 'Bearer',
        data: {},
      }

      mockGetToken.mockResolvedValue(mockToken)

      const result = await client.exchangeCodeForToken('auth-code-123', 'verifier-123')

      expect(result.expiresAt).toBe(0)
    })

    it('should handle token without refreshToken', async () => {
      const mockToken = {
        accessToken: 'access-token-123',
        tokenType: 'Bearer',
        data: {
          expires_in: 3600,
        },
      }

      mockGetToken.mockResolvedValue(mockToken)

      const result = await client.exchangeCodeForToken('auth-code-123', 'verifier-123')

      expect(result.refreshToken).toBe('')
    })

    it('should handle token without tokenType', async () => {
      const mockToken = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        data: {
          expires_in: 3600,
        },
      }

      mockGetToken.mockResolvedValue(mockToken)

      const result = await client.exchangeCodeForToken('auth-code-123', 'verifier-123')

      expect(result.tokenType).toBe('Bearer')
    })

    it('should throw error with fallback message when error has no body or message', async () => {
      const error = {}
      mockGetToken.mockRejectedValue(error)

      await expect(client.exchangeCodeForToken('invalid-code', 'verifier-123')).rejects.toThrow(
        'Token exchange failed',
      )
    })

    it('should throw error with error.message when no error_description', async () => {
      const error = new Error('Network error')
      mockGetToken.mockRejectedValue(error)

      await expect(client.exchangeCodeForToken('invalid-code', 'verifier-123')).rejects.toThrow(
        'Network error',
      )
    })
  })

  describe('isTokenExpired', () => {
    it('should return false when token has no expiry', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: 0,
        tokenType: 'Bearer',
      }

      expect(client.isTokenExpired(tokens)).toBe(false)
    })

    it('should return false when token expires in more than 5 minutes', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes from now
        tokenType: 'Bearer',
      }

      expect(client.isTokenExpired(tokens)).toBe(false)
    })

    it('should return true when token expires in less than 5 minutes', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3 * 60 * 1000, // 3 minutes from now
        tokenType: 'Bearer',
      }

      expect(client.isTokenExpired(tokens)).toBe(true)
    })

    it('should return true when token is already expired', () => {
      const tokens: OAuthTokens = {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000, // 1 second ago
        tokenType: 'Bearer',
      }

      expect(client.isTokenExpired(tokens)).toBe(true)
    })
  })
})
