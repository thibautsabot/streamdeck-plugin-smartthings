import { Smartthings } from '../smartthings-plugin'
import { isGlobalSettingsSet } from '../utils/index'
import { createMockGlobalSettings, createMockOAuthTokens } from '../test-helpers/oauth-fixtures'

const HOUR = 3600000

const newest = createMockGlobalSettings({
  oauthTokens: createMockOAuthTokens({ refreshToken: 'newest', expiresAt: Date.now() + 24 * HOUR }),
})
const older = createMockGlobalSettings({
  oauthTokens: createMockOAuthTokens({ refreshToken: 'older', expiresAt: Date.now() - 3 * HOUR }),
})

describe('Smartthings plugin credentials', () => {
  let plugin: Smartthings
  let sentToStreamDeck: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    localStorage.clear()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    plugin = new Smartthings()
    // Nothing is connected to a real Stream Deck here: record what would be written to it
    sentToStreamDeck = jest.spyOn(plugin, 'setGlobalSettings').mockImplementation()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  /**
   * What the SDK really does when Stream Deck delivers settings: it stores them in its cache
   * first, then calls the handlers. The handler therefore never sees the previous settings.
   */
  function streamDeckDelivers(settings: unknown): void {
    plugin.settingsManager.cacheGlobalSettings(settings as object)
    plugin.onDidReceiveGlobalSettings({ payload: { settings } })
    jest.runAllTimers()
  }

  it('puts the newest tokens back when Stream Deck answers with the pre-refresh ones', () => {
    plugin.credentials.remember(newest)

    streamDeckDelivers(older)

    expect(plugin.settingsManager.getGlobalSettings()).toEqual(newest)
    expect(sentToStreamDeck).toHaveBeenCalledWith(newest)
  })

  it('puts its own credentials back when Stream Deck answers with nothing', () => {
    plugin.credentials.remember(newest)

    streamDeckDelivers({})

    expect(plugin.settingsManager.getGlobalSettings()).toEqual(newest)
    expect(sentToStreamDeck).toHaveBeenCalledWith(newest)
  })

  it('puts the backup from a previous run back when Stream Deck starts with nothing', () => {
    plugin.credentials.remember(newest)
    // Plugin restart: new process, same localStorage
    plugin = new Smartthings()
    sentToStreamDeck = jest.spyOn(plugin, 'setGlobalSettings').mockImplementation()
    const logged = jest.spyOn(console, 'warn').mockImplementation()

    streamDeckDelivers({})

    expect(plugin.settingsManager.getGlobalSettings()).toEqual(newest)
    expect(sentToStreamDeck).toHaveBeenCalledWith(newest)
    expect(logged).toHaveBeenCalledWith(
      "Stream Deck sent no credentials: restoring the plugin's own copy",
    )
  })

  it('does not restore the credentials after a Sign Out', async () => {
    streamDeckDelivers(newest)

    await plugin.onSendToPlugin({
      action: 'act',
      context: 'ctx',
      payload: { event: 'expectSignOut' },
    })
    streamDeckDelivers(undefined)

    expect(plugin.credentials.get()).toBeNull()
    expect(sentToStreamDeck).not.toHaveBeenCalled()
    expect(isGlobalSettingsSet(plugin.settingsManager.getGlobalSettings())).toBe(false)
  })
})
