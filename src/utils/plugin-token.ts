/**
 * Plugin-side token service.
 *
 * The plugin process is the only place that refreshes tokens. The property inspector
 * (settings panel) asks it for a token through sendToPlugin/sendToPropertyInspector messages.
 */

import { isGlobalSettingsSet } from './index'
import { GlobalSettingsInterface } from './interface'
import { OAuthTokens } from './oauth-client'
import { forceRefreshAccessToken, getValidAccessToken, isAuthRevoked } from './token-manager'

export interface TokenRequestMessage {
  event: 'getToken'
  requestId: string
  /** Access token the API rejected with a 401: forces a refresh */
  rejectedAccessToken?: string
}

export interface TokenResponseMessage {
  event: 'token'
  requestId: string
  accessToken?: string
  error?: 'not_configured' | 'refresh_failed' | 'auth_revoked'
}

export interface SettingsHolder {
  settingsManager: {
    getGlobalSettings<T>(): T | object
    setGlobalSettings<T>(settings: T): void
  }
}

export interface PluginLike extends SettingsHolder {
  sendToPropertyInspector(payload: unknown, action: string, context: string): void
}

export interface SendToPluginEventLike {
  action: string
  context: string
  payload?: { event?: string } & Partial<TokenRequestMessage>
}

function readSettings(plugin: SettingsHolder): GlobalSettingsInterface | null {
  const settings = plugin.settingsManager.getGlobalSettings<GlobalSettingsInterface>()
  return isGlobalSettingsSet(settings) ? settings : null
}

function createSaver(plugin: SettingsHolder) {
  return (newTokens: OAuthTokens) => {
    // Merge into the latest settings, not the copy captured before the refresh started
    const latest = readSettings(plugin)
    if (!latest) return
    plugin.settingsManager.setGlobalSettings<GlobalSettingsInterface>({
      ...latest,
      oauthTokens: newTokens,
    })
  }
}

/**
 * Get a valid access token, refreshing when needed. Null if not configured or refresh failed.
 */
export async function getPluginAccessToken(plugin: SettingsHolder): Promise<string | null> {
  const settings = readSettings(plugin)
  if (!settings) return null

  return getValidAccessToken(settings, createSaver(plugin), () => readSettings(plugin))
}

/**
 * Force a refresh after the API answered 401 for `rejectedAccessToken`.
 */
export async function refreshPluginAccessToken(
  plugin: SettingsHolder,
  rejectedAccessToken: string,
): Promise<string | null> {
  const settings = readSettings(plugin)
  if (!settings) return null

  return forceRefreshAccessToken(settings, rejectedAccessToken, createSaver(plugin), () =>
    readSettings(plugin),
  )
}

/**
 * True when SmartThings permanently rejected the stored refresh token (sign-in needed).
 */
export function isPluginAuthRevoked(plugin: SettingsHolder): boolean {
  const settings = readSettings(plugin)
  return settings !== null && isAuthRevoked(settings)
}

/**
 * Answer a `getToken` message coming from a property inspector.
 */
export async function handleTokenRequest(
  plugin: PluginLike,
  event: SendToPluginEventLike,
): Promise<void> {
  const payload = event?.payload
  if (!payload || payload.event !== 'getToken') return

  const response: TokenResponseMessage = { event: 'token', requestId: payload.requestId ?? '' }

  if (!readSettings(plugin)) {
    response.error = 'not_configured'
  } else {
    const accessToken = payload.rejectedAccessToken
      ? await refreshPluginAccessToken(plugin, payload.rejectedAccessToken)
      : await getPluginAccessToken(plugin)

    if (accessToken) {
      response.accessToken = accessToken
    } else {
      response.error = isPluginAuthRevoked(plugin) ? 'auth_revoked' : 'refresh_failed'
    }
  }

  plugin.sendToPropertyInspector(response, event.action, event.context)
}
