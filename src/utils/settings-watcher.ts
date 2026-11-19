/**
 * Watches the global settings Stream Deck hands over and reports suspicious changes.
 *
 * The question we need to answer for "I have to sign in again" reports is: did Stream Deck hand
 * us empty settings, or did the token refresh fail? Comparing each snapshot with the previous one
 * turns that into a single WARN line.
 */

import { describeGlobalSettings } from './logger'

export type SettingsState = 'set' | 'empty' | 'undefined'

interface SettingsLike {
  oauthClientId?: string
  oauthClientSecret?: string
  oauthTokens?: { accessToken?: string; refreshToken?: string }
}

export function getSettingsState(settings: unknown): SettingsState {
  if (settings === undefined || settings === null) return 'undefined'
  const s = settings as SettingsLike
  if (Object.keys(s).length === 0) return 'empty'
  const complete = s.oauthClientId && s.oauthClientSecret && s.oauthTokens?.refreshToken
  return complete ? 'set' : 'empty'
}

export class SettingsWatcher {
  private previous: SettingsState | null = null
  private expectedClear = false

  /** Call right before this process clears the settings on purpose (Sign Out). */
  public expectClear(): void {
    this.expectedClear = true
  }

  /**
   * Record a snapshot received from Stream Deck.
   * @param origin where it was received, for the log line
   */
  public record(settings: unknown, origin: string): SettingsState {
    const state = getSettingsState(settings)

    console.log(`Global settings received (${origin}): ${describeGlobalSettings(settings)}`)

    if (this.previous === 'set' && state !== 'set') {
      if (this.expectedClear) {
        console.warn(`Global settings cleared by the user (Sign Out): set -> ${state}`)
      } else {
        console.warn(
          `Global settings LOST without a Sign Out: set -> ${state}. ` +
            'Stream Deck handed over empty settings, this is not a token refresh problem.',
        )
      }
    } else if (this.previous !== null && this.previous !== 'set' && state === 'set') {
      console.log(`Global settings are back: ${this.previous} -> set`)
    }

    if (state === 'set') this.expectedClear = false
    this.previous = state
    return state
  }
}
