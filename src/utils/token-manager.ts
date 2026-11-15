/**
 * Shared token management utilities for OAuth tokens
 *
 * SmartThings rotates refresh tokens: each refresh invalidates the previous one.
 * Sending several refreshes with the same token makes all but the first fail (and may
 * revoke the session), so refreshes are de-duplicated through a single in-flight promise.
 */

import { GlobalSettingsInterface } from './interface'
import { SmartThingsOAuthClient, OAuthTokens } from './oauth-client'

type SaveTokens = (tokens: OAuthTokens) => void | Promise<void>
type GetLatestSettings = () => GlobalSettingsInterface | null

// Single refresh shared by every caller of this JS context (plugin or property inspector)
let inFlightRefresh: Promise<string | null> | null = null

// Refresh token that SmartThings definitively rejected (user must sign in again)
let rejectedRefreshToken: string | null = null

const PERMANENT_ERROR_CODES = ['invalid_grant', 'invalid_client', 'unauthorized_client']

interface RefreshError {
  code?: string
  status?: number
  body?: { error?: string; error_description?: string }
  message?: string
}

function describeError(error: unknown): string {
  const err = error as RefreshError
  const code = err?.body?.error || err?.code
  const description = err?.body?.error_description || err?.message
  return [code, description].filter(Boolean).join(': ') || 'unknown error'
}

function isPermanentError(error: unknown): boolean {
  const err = error as RefreshError
  const code = err?.body?.error || err?.code
  if (code !== undefined && PERMANENT_ERROR_CODES.includes(code)) return true
  // SmartThings can also answer with a bare HTTP 400/401 (HTML body, no OAuth error code)
  return err?.status === 400 || err?.status === 401
}

/**
 * True when SmartThings rejected the stored refresh token: the user has to sign in again.
 * Resets by itself once a different refresh token is stored (new sign-in).
 */
export function isAuthRevoked(globalSettings: GlobalSettingsInterface): boolean {
  return (
    rejectedRefreshToken !== null &&
    globalSettings.oauthTokens?.refreshToken === rejectedRefreshToken
  )
}

/**
 * Get a valid access token, refreshing if needed
 *
 * @param globalSettings - Current global settings with OAuth tokens
 * @param saveTokens - Callback to save refreshed tokens
 * @param getLatestSettings - Optional, returns the most recent settings (avoids using a stale refresh token)
 * @returns Access token or null if refresh fails
 */
export async function getValidAccessToken(
  globalSettings: GlobalSettingsInterface,
  saveTokens: SaveTokens,
  getLatestSettings?: GetLatestSettings,
): Promise<string | null> {
  const oauthClient = new SmartThingsOAuthClient(
    globalSettings.oauthClientId,
    globalSettings.oauthClientSecret,
  )

  // Check if token needs refresh based on expiry time
  if (oauthClient.isTokenExpired(globalSettings.oauthTokens)) {
    return refreshAccessToken(globalSettings, oauthClient, saveTokens, getLatestSettings)
  }

  return globalSettings.oauthTokens.accessToken
}

/**
 * Refresh the access token using the refresh token.
 * Concurrent calls share the same request.
 *
 * @param globalSettings - Current global settings with OAuth tokens
 * @param oauthClient - OAuth client instance
 * @param saveTokens - Callback to save refreshed tokens
 * @param getLatestSettings - Optional, returns the most recent settings
 * @param rejectedAccessToken - Optional, access token the API answered 401 for: forces a refresh
 *   unless the stored token is already a different (newer) one
 * @returns New access token or null if refresh fails
 */
export function refreshAccessToken(
  globalSettings: GlobalSettingsInterface,
  oauthClient: SmartThingsOAuthClient,
  saveTokens: SaveTokens,
  getLatestSettings?: GetLatestSettings,
  rejectedAccessToken?: string,
): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = doRefresh(
    globalSettings,
    oauthClient,
    saveTokens,
    getLatestSettings,
    rejectedAccessToken,
  ).finally(() => {
    inFlightRefresh = null
  })
  return inFlightRefresh
}

/**
 * Refresh after the API rejected an access token (401), even if it looks valid locally.
 */
export function forceRefreshAccessToken(
  globalSettings: GlobalSettingsInterface,
  rejectedAccessToken: string,
  saveTokens: SaveTokens,
  getLatestSettings?: GetLatestSettings,
): Promise<string | null> {
  const oauthClient = new SmartThingsOAuthClient(
    globalSettings.oauthClientId,
    globalSettings.oauthClientSecret,
  )
  return refreshAccessToken(
    globalSettings,
    oauthClient,
    saveTokens,
    getLatestSettings,
    rejectedAccessToken,
  )
}

async function doRefresh(
  globalSettings: GlobalSettingsInterface,
  oauthClient: SmartThingsOAuthClient,
  saveTokens: SaveTokens,
  getLatestSettings?: GetLatestSettings,
  rejectedAccessToken?: string,
): Promise<string | null> {
  // Another refresh may have finished since the caller read its settings
  const latest = getLatestSettings?.() ?? globalSettings
  const alreadyRefreshed =
    latest.oauthTokens &&
    !oauthClient.isTokenExpired(latest.oauthTokens) &&
    latest.oauthTokens.accessToken !== rejectedAccessToken
  if (alreadyRefreshed) {
    return latest.oauthTokens.accessToken
  }

  const refreshToken = latest.oauthTokens.refreshToken

  try {
    console.log('[TokenManager] Refreshing expired token...')
    const newTokens = await oauthClient.refreshToken(refreshToken)

    // Save refreshed tokens via callback
    await saveTokens(newTokens)

    rejectedRefreshToken = null
    console.log('[TokenManager] Token refreshed successfully')
    return newTokens.accessToken
  } catch (error) {
    console.error(`[TokenManager] Token refresh failed (${describeError(error)}):`, error)
    if (isPermanentError(error)) {
      rejectedRefreshToken = refreshToken
    }
    return null
  }
}
