import { GlobalSettingsInterface } from '../utils/interface'
import { OAuthTokens } from '../utils/oauth-client'

/**
 * Create mock OAuth tokens for testing
 */
export function createMockOAuthTokens(overrides?: Partial<OAuthTokens>): OAuthTokens {
  return {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    tokenType: 'Bearer',
    ...overrides,
  }
}

/**
 * Create mock global settings with OAuth for testing
 */
export function createMockGlobalSettings(
  overrides?: Partial<GlobalSettingsInterface>,
): GlobalSettingsInterface {
  return {
    oauthTokens: createMockOAuthTokens(),
    oauthClientId: 'mock-client-id',
    oauthClientSecret: 'mock-client-secret',
    ...overrides,
  }
}

/**
 * Create expired OAuth tokens for testing refresh logic
 */
export function createExpiredOAuthTokens(): OAuthTokens {
  return createMockOAuthTokens({
    expiresAt: Date.now() - 1000, // Expired 1 second ago
  })
}
