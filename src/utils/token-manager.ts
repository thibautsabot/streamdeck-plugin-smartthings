/**
 * Shared token management utilities for OAuth tokens
 */

import { GlobalSettingsInterface } from './interface'
import { SmartThingsOAuthClient, OAuthTokens } from './oauth-client'

/**
 * Get a valid access token, refreshing if needed
 *
 * @param globalSettings - Current global settings with OAuth tokens
 * @param saveTokens - Callback to save refreshed tokens
 * @returns Access token or null if refresh fails
 */
export async function getValidAccessToken(
  globalSettings: GlobalSettingsInterface,
  saveTokens: (tokens: OAuthTokens) => void | Promise<void>,
): Promise<string | null> {
  const oauthClient = new SmartThingsOAuthClient(
    globalSettings.oauthClientId,
    globalSettings.oauthClientSecret,
  )

  // Check if token needs refresh based on expiry time
  if (oauthClient.isTokenExpired(globalSettings.oauthTokens)) {
    return refreshAccessToken(globalSettings, oauthClient, saveTokens)
  }

  return globalSettings.oauthTokens.accessToken
}

/**
 * Refresh the access token using the refresh token
 *
 * @param globalSettings - Current global settings with OAuth tokens
 * @param oauthClient - OAuth client instance
 * @param saveTokens - Callback to save refreshed tokens
 * @returns New access token or null if refresh fails
 */
export async function refreshAccessToken(
  globalSettings: GlobalSettingsInterface,
  oauthClient: SmartThingsOAuthClient,
  saveTokens: (tokens: OAuthTokens) => void | Promise<void>,
): Promise<string | null> {
  try {
    console.log('[TokenManager] Refreshing expired token...')
    const newTokens = await oauthClient.refreshToken(globalSettings.oauthTokens.refreshToken)

    // Save refreshed tokens via callback
    await saveTokens(newTokens)

    console.log('[TokenManager] Token refreshed successfully')
    return newTokens.accessToken
  } catch (error) {
    console.error('[TokenManager] Token refresh failed:', error)
    return null
  }
}
