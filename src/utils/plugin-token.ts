/**
 * Plugin-side token service.
 *
 * The plugin process is the only place that refreshes tokens. The property inspector
 * (settings panel) asks it for a token through sendToPlugin/sendToPropertyInspector messages.
 */

import { isGlobalSettingsSet } from './index'
import { CredentialStore } from './credential-store'
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

export interface AuthStatusRequestMessage {
  event: 'getAuthStatus'
  requestId: string
}

export interface AuthStatusResponseMessage {
  event: 'authStatus'
  requestId: string
  /** True when the plugin holds credentials, even ones SmartThings may have revoked */
  signedIn: boolean
  /** Sent so the panel can pre-fill the sign-in form without reading Stream Deck's settings */
  clientId?: string
  clientSecret?: string
}

export interface SettingsHolder {
  settingsManager: {
    getGlobalSettings<T>(): T | object
    setGlobalSettings<T>(settings: T): void
  }
  /** The plugin's own copy of the credentials, kept apart from Stream Deck's settings */
  credentials?: CredentialStore
}

export interface PluginLike extends SettingsHolder {
  sendToPropertyInspector(payload: unknown, action: string, context: string): void
}

export interface SendToPluginEventLike {
  action: string
  context: string
  payload?: { event?: string; requestId?: string; rejectedAccessToken?: string }
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
    const updated: GlobalSettingsInterface = { ...latest, oauthTokens: newTokens }
    // Keep our own copy first: the refresh token just used is dead, this one is the only valid one
    plugin.credentials?.remember(updated)
    plugin.settingsManager.setGlobalSettings<GlobalSettingsInterface>(updated)
    console.log('Saved refreshed tokens')
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
  console.log(
    `[PluginToken] Token requested by a settings panel${
      payload.rejectedAccessToken ? ' (after a 401)' : ''
    }`,
  )

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

  console.log(`[PluginToken] Replying to the settings panel: ${response.error ?? 'token sent'}`)
  plugin.sendToPropertyInspector(response, event.action, event.context)
}

/**
 * Answer a `getAuthStatus` message: is there a session, according to the plugin?
 * The panel asks the plugin instead of reading Stream Deck's settings, which can be empty or
 * outdated while the plugin still holds valid credentials.
 */
export function handleAuthStatusRequest(plugin: PluginLike, event: SendToPluginEventLike): void {
  const payload = event?.payload
  if (!payload || payload.event !== 'getAuthStatus') return

  const fromSettings = readSettings(plugin)
  const credentials = fromSettings ?? plugin.credentials?.get() ?? null
  const response: AuthStatusResponseMessage = {
    event: 'authStatus',
    requestId: payload.requestId ?? '',
    // A session SmartThings revoked still counts: the panel then reports it when it asks for a token
    signedIn: credentials !== null,
  }
  if (credentials) {
    response.clientId = credentials.oauthClientId
    response.clientSecret = credentials.oauthClientSecret
  }

  const source = fromSettings
    ? "Stream Deck's settings"
    : credentials
      ? "the plugin's own copy (Stream Deck's settings are empty)"
      : 'nowhere'
  console.log(
    `[PluginToken] Auth status requested by a settings panel: signedIn=${response.signedIn}, credentials from ${source}`,
  )
  plugin.sendToPropertyInspector(response, event.action, event.context)
}
