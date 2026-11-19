import { SettingsWatcher, getSettingsState } from '../settings-watcher'

const full = {
  oauthClientId: 'id',
  oauthClientSecret: 'secret',
  oauthTokens: { accessToken: 'a', refreshToken: 'r', expiresAt: 0 },
}

describe('getSettingsState', () => {
  it('classifies the settings', () => {
    expect(getSettingsState(undefined)).toBe('undefined')
    expect(getSettingsState(null)).toBe('undefined')
    expect(getSettingsState({})).toBe('empty')
    expect(getSettingsState(full)).toBe('set')
  })

  it('treats partial credentials as not set', () => {
    expect(getSettingsState({ oauthClientId: 'id' })).toBe('empty')
    expect(getSettingsState({ ...full, oauthTokens: { accessToken: 'a' } })).toBe('empty')
  })
})

describe('SettingsWatcher', () => {
  let log: jest.SpyInstance
  let warn: jest.SpyInstance
  let watcher: SettingsWatcher

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation()
    warn = jest.spyOn(console, 'warn').mockImplementation()
    watcher = new SettingsWatcher()
  })

  afterEach(() => jest.restoreAllMocks())

  it('logs each snapshot with its origin and no secret', () => {
    watcher.record(full, 'plugin')

    expect(log).toHaveBeenCalledWith(expect.stringContaining('Global settings received (plugin)'))
    expect(log.mock.calls[0][0]).not.toContain('secret')
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not warn for the very first empty snapshot (fresh install)', () => {
    watcher.record({}, 'plugin')

    expect(warn).not.toHaveBeenCalled()
  })

  it('warns loudly when settings go from set to empty without a Sign Out', () => {
    watcher.record(full, 'plugin')
    watcher.record({}, 'panel')

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('LOST without a Sign Out: set -> empty'),
    )
  })

  it('reports undefined as a loss too', () => {
    watcher.record(full, 'plugin')
    watcher.record(undefined, 'plugin')

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('LOST without a Sign Out: set -> undefined'),
    )
  })

  it('does not call a deliberate Sign Out a loss', () => {
    watcher.record(full, 'plugin')
    watcher.expectClear()
    watcher.record(undefined, 'plugin')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cleared by the user (Sign Out)'))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('LOST'))
  })

  it('forgets the Sign Out once the user signs in again', () => {
    watcher.record(full, 'plugin')
    watcher.expectClear()
    watcher.record({}, 'plugin')
    watcher.record(full, 'plugin')
    watcher.record({}, 'plugin')

    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('LOST'))
  })

  it('logs when the settings come back', () => {
    watcher.record(full, 'plugin')
    watcher.record({}, 'plugin')
    watcher.record(full, 'plugin')

    expect(log).toHaveBeenCalledWith('Global settings are back: empty -> set')
  })

  it('stays quiet while the settings keep the same state', () => {
    watcher.record(full, 'plugin')
    watcher.record(full, 'panel')
    watcher.record(full, 'plugin')

    expect(warn).not.toHaveBeenCalled()
  })
})
