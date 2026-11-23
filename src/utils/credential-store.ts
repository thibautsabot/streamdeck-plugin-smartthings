/**
 * The plugin's own copy of the credentials.
 *
 * Stream Deck's global settings are shared with the settings panel and the SDK overwrites its
 * in-memory copy with whatever Stream Deck sends, even when that is empty or older than what the
 * plugin just saved. SmartThings rotates refresh tokens, so losing the newest one forces a new
 * sign-in. This store keeps the newest credentials the plugin knows about and decides what to do
 * with each delivery from Stream Deck.
 *
 * The copy is also written to the plugin's localStorage so it survives a restart: Stream Deck has
 * been seen handing over empty settings at startup, when an in-memory copy is already gone.
 * Storage failures are never fatal, the store then simply works in memory only.
 */

import { GlobalSettingsInterface } from './interface'
import { isGlobalSettingsSet } from './index'

export const STORAGE_KEY = 'smartthings.credentials.backup'

export type Reconciliation =
  | { action: 'accept' }
  | { action: 'restore'; credentials: GlobalSettingsInterface; reason: string }

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch (error) {
    // Access to localStorage can throw when it is disabled
    console.error('localStorage is unavailable, the credentials backup is disabled:', error)
    return null
  }
}

export class CredentialStore {
  private trusted: GlobalSettingsInterface | null = null
  private readonly storage: StorageLike | null

  constructor(storage: StorageLike | null = defaultStorage()) {
    this.storage = storage
    this.trusted = this.load()
  }

  /** The newest credentials known to the plugin, or null when there are none. */
  public get(): GlobalSettingsInterface | null {
    return this.trusted
  }

  /** Remember credentials the plugin just obtained or received. */
  public remember(credentials: GlobalSettingsInterface): void {
    this.trusted = credentials
    this.save(credentials)
  }

  /** Forget everything (Sign Out). */
  public forget(): void {
    this.trusted = null
    try {
      this.storage?.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Could not delete the credentials backup:', error)
    }
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

  private load(): GlobalSettingsInterface | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      return isGlobalSettingsSet(parsed) ? parsed : null
    } catch (error) {
      console.error('Could not read the credentials backup:', error)
      return null
    }
  }

  private save(credentials: GlobalSettingsInterface): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(credentials))
    } catch (error) {
      console.error('Could not write the credentials backup:', error)
    }
  }
}
