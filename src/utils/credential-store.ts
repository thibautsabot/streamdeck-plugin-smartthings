/**
 * The plugin's own copy of the credentials, kept in memory.
 *
 * Stream Deck's global settings are shared with the settings panel and the SDK overwrites its
 * in-memory copy with whatever Stream Deck sends, even when that is empty or older than what the
 * plugin just saved. SmartThings rotates refresh tokens, so losing the newest one forces a new
 * sign-in. This store keeps the newest credentials the plugin knows about and decides what to do
 * with each delivery from Stream Deck.
 *
 * It lives only as long as the plugin process: nothing is written anywhere else.
 */

import { GlobalSettingsInterface } from './interface'
import { isGlobalSettingsSet } from './index'

export type Reconciliation =
  | { action: 'accept' }
  | { action: 'restore'; credentials: GlobalSettingsInterface; reason: string }

export class CredentialStore {
  private trusted: GlobalSettingsInterface | null = null

  /** The newest credentials known to the plugin, or null when there are none. */
  public get(): GlobalSettingsInterface | null {
    return this.trusted
  }

  /** Remember credentials the plugin just obtained or received. */
  public remember(credentials: GlobalSettingsInterface): void {
    this.trusted = credentials
  }

  /** Forget everything (Sign Out). */
  public forget(): void {
    this.trusted = null
  }

  /**
   * Decide what to do with settings delivered by Stream Deck.
   * Accepted credentials become the new reference; empty or older ones are replaced by ours.
   */
  public reconcile(incoming: unknown): Reconciliation {
    const trusted = this.trusted

    if (!isGlobalSettingsSet(incoming)) {
      if (!trusted) return { action: 'accept' }
      return {
        action: 'restore',
        credentials: trusted,
        reason: 'Stream Deck sent no credentials',
      }
    }

    // A different client id is a new sign-in, not an old copy of the same session
    const sameSession = trusted !== null && trusted.oauthClientId === incoming.oauthClientId
    if (sameSession && incoming.oauthTokens.expiresAt < trusted.oauthTokens.expiresAt) {
      return {
        action: 'restore',
        credentials: trusted,
        reason: 'Stream Deck sent tokens older than the ones the plugin already has',
      }
    }

    this.remember(incoming)
    return { action: 'accept' }
  }
}
