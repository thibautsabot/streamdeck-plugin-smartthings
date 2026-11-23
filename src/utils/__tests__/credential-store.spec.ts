import { CredentialStore, STORAGE_KEY } from '../credential-store'
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
    localStorage.clear()
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

describe('CredentialStore persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => jest.restoreAllMocks())

  it('restores credentials after a restart when Stream Deck sends nothing', () => {
    new CredentialStore().remember(newest)

    const afterRestart = new CredentialStore()

    expect(afterRestart.get()).toEqual(newest)
    expect(afterRestart.reconcile({})).toMatchObject({ action: 'restore', credentials: newest })
  })

  it('restores the backup after a restart when Stream Deck sends older tokens', () => {
    new CredentialStore().remember(newest)

    expect(new CredentialStore().reconcile(older)).toMatchObject({
      action: 'restore',
      credentials: newest,
    })
  })

  it('saves what Stream Deck delivers', () => {
    new CredentialStore().reconcile(newest)

    expect(new CredentialStore().get()).toEqual(newest)
  })

  it('deletes the backup on forget', () => {
    const store = new CredentialStore()
    store.remember(newest)
    store.forget()

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(new CredentialStore().get()).toBeNull()
  })

  it('ignores a corrupted or incomplete backup', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(new CredentialStore().get()).toBeNull()

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ oauthClientId: 'x' }))
    expect(new CredentialStore().get()).toBeNull()
  })

  it('still works in memory when storage is unavailable or throws', () => {
    const broken = {
      getItem: jest.fn(() => {
        throw new Error('denied')
      }),
      setItem: jest.fn(() => {
        throw new Error('quota')
      }),
      removeItem: jest.fn(() => {
        throw new Error('denied')
      }),
    }
    const store = new CredentialStore(broken)

    store.remember(newest)
    expect(store.get()).toEqual(newest)
    expect(() => store.forget()).not.toThrow()
    expect(new CredentialStore(null).get()).toBeNull()
    // read, write and delete failures are all logged
    expect(console.error).toHaveBeenCalledTimes(3)
  })
})
