import { CredentialStore } from '../credential-store'
import { createMockGlobalSettings, createMockOAuthTokens } from '../../test-helpers/oauth-fixtures'

const HOUR = 3600000

const newest = createMockGlobalSettings({
  oauthTokens: createMockOAuthTokens({ refreshToken: 'newest', expiresAt: Date.now() + 24 * HOUR }),
})
const older = createMockGlobalSettings({
  oauthTokens: createMockOAuthTokens({ refreshToken: 'older', expiresAt: Date.now() + HOUR }),
})

describe('CredentialStore.reconcile', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => jest.restoreAllMocks())

  it('accepts anything when the plugin has nothing of its own', () => {
    const store = new CredentialStore()

    expect(store.reconcile({})).toEqual({ action: 'accept' })
    expect(store.reconcile(newest)).toEqual({ action: 'accept' })
    expect(store.get()).toEqual(newest)
  })

  it('restores its own credentials when Stream Deck sends none', () => {
    const store = new CredentialStore()
    store.remember(newest)

    expect(store.reconcile({})).toMatchObject({ action: 'restore', credentials: newest })
    expect(store.reconcile(undefined)).toMatchObject({ action: 'restore', credentials: newest })
  })

  it('restores its own credentials when Stream Deck sends older tokens', () => {
    const store = new CredentialStore()
    store.remember(newest)

    expect(store.reconcile(older)).toMatchObject({ action: 'restore', credentials: newest })
    expect(store.get()).toEqual(newest)
  })

  it('accepts newer tokens and remembers them', () => {
    const store = new CredentialStore()
    store.remember(older)

    expect(store.reconcile(newest)).toEqual({ action: 'accept' })
    expect(store.get()).toEqual(newest)
  })

  it('treats another client id as a new sign-in, even with an earlier expiry', () => {
    const store = new CredentialStore()
    store.remember(newest)
    const otherApp = createMockGlobalSettings({
      oauthClientId: 'other-client',
      oauthTokens: createMockOAuthTokens({ expiresAt: Date.now() + HOUR }),
    })

    expect(store.reconcile(otherApp)).toEqual({ action: 'accept' })
    expect(store.get()).toEqual(otherApp)
  })
})
