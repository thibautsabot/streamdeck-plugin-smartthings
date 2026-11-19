import pkg from '../../../package.json'
import manifest from '../../../com.thibautsabot.streamdeck.smartthings.sdPlugin/manifest.json'
import {
  PLUGIN_VERSION,
  REPEAT_WINDOW_MS,
  installCrashLogging,
  describeGlobalSettings,
  formatLogLine,
  installLogForwarding,
  redactText,
} from '../logger'

const NOW = new Date('2026-11-19T10:00:00.000Z')

describe('redactText', () => {
  it('hides bearer and basic credentials', () => {
    expect(redactText('Authorization: Bearer abc.def-123')).toBe('Authorization: Bearer [redacted]')
    expect(redactText('Basic dXNlcjpwYXNz')).toBe('Basic [redacted]')
  })

  it('hides OAuth query and body parameters', () => {
    const text = 'GET /cb?code=8EJ4IO&state=x refresh_token=abc123 client_secret=s3cret'
    const result = redactText(text)

    expect(result).not.toContain('8EJ4IO')
    expect(result).not.toContain('abc123')
    expect(result).not.toContain('s3cret')
    expect(result).toContain('state=x')
  })

  it('shortens uuids (client ids, tokens) to a prefix', () => {
    const result = redactText('client 50f3097d-e6ff-43a5-9f7d-e5ccb141adf5 failed')

    expect(result).toBe('client 50f3… failed')
  })
})

describe('formatLogLine', () => {
  it('prefixes timestamp, level and source', () => {
    expect(formatLogLine('INFO', 'plugin', ['hello', 'world'], NOW)).toBe(
      '[2026-11-19T10:00:00.000Z] INFO plugin hello world',
    )
  })

  it('formats errors with their HTTP status', () => {
    const error = Object.assign(new Error('HTTP 401: Unauthorized'), { status: 401 })

    expect(formatLogLine('ERROR', 'pi', ['failed:', error], NOW)).toContain(
      'Error: HTTP 401: Unauthorized (status 401)',
    )
  })

  it('recognises errors created in another JS context', () => {
    const foreign = {
      name: 'Error',
      message: 'from elsewhere',
      stack: 'Error: from elsewhere\n at x',
    }

    expect(formatLogLine('ERROR', 'pi', [foreign], NOW)).toContain('Error: from elsewhere')
    expect(formatLogLine('ERROR', 'pi', [foreign], NOW)).not.toContain('"stack"')
  })

  it('removes secrets from logged objects, at any depth', () => {
    const settings = {
      oauthClientSecret: 'super-secret',
      oauthTokens: { accessToken: 'AAA', refreshToken: 'RRR', expiresAt: 5 },
      code: '8EJ4IO',
      visible: 'ok',
    }

    const line = formatLogLine('INFO', 'plugin', [settings], NOW)

    for (const secret of ['super-secret', 'AAA', 'RRR', '8EJ4IO']) {
      expect(line).not.toContain(secret)
    }
    expect(line).toContain('"visible":"ok"')
    expect(line).toContain('"expiresAt":5')
  })

  it('clips long messages and long strings inside objects', () => {
    const long = 'x'.repeat(5000)

    expect(formatLogLine('INFO', 'plugin', [long], NOW).length).toBeLessThan(1700)
    expect(formatLogLine('ERROR', 'plugin', [{ body: long }], NOW)).toContain('5000 chars')
  })

  it('handles undefined, null, numbers and circular objects', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    const line = formatLogLine('INFO', 'plugin', [undefined, null, 42, circular], NOW)

    expect(line).toContain('undefined null 42')
    expect(line).toContain('[object Object]')
  })

  it('falls back to the message for objects that cannot be serialized to JSON', () => {
    expect(formatLogLine('INFO', 'plugin', [() => 1], NOW)).toContain('() => 1')
    expect(
      formatLogLine('INFO', 'plugin', [{ toJSON: () => undefined, message: 'm' }], NOW),
    ).toContain('m')
  })
})

describe('installLogForwarding', () => {
  let restore: () => void
  let sink: jest.Mock

  beforeEach(() => {
    ;(['log', 'info', 'warn', 'error'] as const).forEach((level) =>
      jest.spyOn(console, level).mockImplementation(),
    )
    sink = jest.fn()
    restore = installLogForwarding(sink, 'plugin')
  })

  afterEach(() => {
    restore()
    jest.restoreAllMocks()
  })

  it.each([
    ['log', 'INFO'],
    ['info', 'INFO'],
    ['warn', 'WARN'],
    ['error', 'ERROR'],
  ] as const)('forwards console.%s as %s and still prints it', (level, label) => {
    console[level]('something happened')

    expect(sink).toHaveBeenCalledWith(expect.stringContaining(`${label} plugin something happened`))
  })

  it('never forwards a token', () => {
    console.log('Authorization: Bearer topsecrettoken')

    expect(sink.mock.calls[0][0]).not.toContain('topsecrettoken')
  })

  it('keeps working if the sink throws', () => {
    sink.mockImplementation(() => {
      throw new Error('socket closed')
    })

    expect(() => console.log('still fine')).not.toThrow()
  })

  it('does not loop if the sink itself logs', () => {
    sink.mockImplementation(() => console.log('from sink'))

    console.log('first')

    expect(sink).toHaveBeenCalledTimes(1)
  })

  it('restores the original console methods', () => {
    restore()
    sink.mockClear()

    console.log('after restore')

    expect(sink).not.toHaveBeenCalled()
  })
})

describe('describeGlobalSettings', () => {
  const NOW_MS = 1_000_000_000_000

  it('distinguishes undefined and empty settings', () => {
    expect(describeGlobalSettings(undefined)).toBe('settings=undefined')
    expect(describeGlobalSettings(null)).toBe('settings=undefined')
    expect(describeGlobalSettings({})).toBe('settings=empty')
  })

  it('reports which fields exist without revealing any value', () => {
    const result = describeGlobalSettings(
      {
        oauthClientId: 'client-id-value',
        oauthClientSecret: 'client-secret-value',
        oauthTokens: {
          accessToken: 'access-value',
          refreshToken: 'refresh-value',
          expiresAt: NOW_MS + 2 * 3600000,
        },
      },
      NOW_MS,
    )

    expect(result).toContain('clientId=yes')
    expect(result).toContain('clientSecret=yes')
    expect(result).toContain('accessToken=yes')
    expect(result).toContain('refreshToken=yes')
    expect(result).toContain('accessTokenExpiresIn=2.0h')
    for (const secret of [
      'client-id-value',
      'client-secret-value',
      'access-value',
      'refresh-value',
    ]) {
      expect(result).not.toContain(secret)
    }
  })

  it('shows missing fields', () => {
    const result = describeGlobalSettings({ oauthClientId: 'x' }, NOW_MS)

    expect(result).toContain('clientSecret=no')
    expect(result).toContain('accessToken=no')
    expect(result).toContain('accessTokenExpiresIn=unknown')
  })

  it('shows an expired token as negative hours', () => {
    const result = describeGlobalSettings(
      { oauthTokens: { accessToken: 'a', refreshToken: 'r', expiresAt: NOW_MS - 3600000 } },
      NOW_MS,
    )

    expect(result).toContain('accessTokenExpiresIn=-1.0h')
  })
})

describe('PLUGIN_VERSION', () => {
  it('matches package.json and the manifest, so logs always show the real version', () => {
    expect(PLUGIN_VERSION).toBe(pkg.version)
    expect(manifest.Version).toBe(`${pkg.version}.0`)
  })
})

describe('repeat suppression', () => {
  let restore: () => void
  let sink: jest.Mock
  let clock: number

  beforeEach(() => {
    ;(['log', 'info', 'warn', 'error'] as const).forEach((level) =>
      jest.spyOn(console, level).mockImplementation(),
    )
    sink = jest.fn()
    clock = 1_000_000
    restore = installLogForwarding(sink, 'plugin', () => clock)
  })

  afterEach(() => {
    restore()
    jest.restoreAllMocks()
  })

  it('sends an identical line only once, then a summary when something else is logged', () => {
    for (let i = 0; i < 5; i++) console.error('Refresh failed')
    clock += 2 * 60 * 1000
    console.log('something else')

    const lines = sink.mock.calls.map((c) => c[0] as string)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('ERROR plugin Refresh failed')
    expect(lines[1]).toContain('previous line repeated 4 more times in the last 2 min')
    expect(lines[2]).toContain('INFO plugin something else')
  })

  it('logs the line again once the repeat window has passed', () => {
    console.error('Refresh failed')
    clock += REPEAT_WINDOW_MS + 1
    console.error('Refresh failed')

    expect(sink).toHaveBeenCalledTimes(2)
  })

  it('does not collapse the same text at a different level', () => {
    console.log('same text')
    console.warn('same text')

    expect(sink).toHaveBeenCalledTimes(2)
  })

  it('flushes a pending summary when forwarding is removed', () => {
    console.error('Refresh failed')
    console.error('Refresh failed')
    restore()

    expect(sink).toHaveBeenCalledTimes(2)
    expect(sink.mock.calls[1][0]).toContain('repeated 1 more times')
    restore = () => undefined
  })
})

describe('installCrashLogging', () => {
  let target: EventTarget
  let remove: () => void

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation()
    target = new EventTarget()
    remove = installCrashLogging(target)
  })

  afterEach(() => jest.restoreAllMocks())

  it('logs uncaught errors with their stack', () => {
    const event = Object.assign(new Event('error'), {
      message: 'boom',
      error: new Error('boom'),
    })

    target.dispatchEvent(event)

    expect(console.error).toHaveBeenCalledWith(
      'Uncaught error: boom',
      expect.stringContaining('Error: boom'),
    )
  })

  it('logs errors that carry no details', () => {
    target.dispatchEvent(new Event('error'))

    expect(console.error).toHaveBeenCalledWith('Uncaught error: unknown', '')
  })

  it('logs unhandled rejections with an Error', () => {
    target.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('nope') }),
    )

    expect(console.error).toHaveBeenCalledWith(
      'Unhandled promise rejection:',
      expect.stringContaining('nope'),
    )
  })

  it('logs unhandled rejections that are not Errors', () => {
    target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: 'plain text' }))

    expect(console.error).toHaveBeenCalledWith('Unhandled promise rejection:', 'plain text')
  })

  it('stops logging after removal', () => {
    remove()

    target.dispatchEvent(new Event('error'))

    expect(console.error).not.toHaveBeenCalled()
  })
})
