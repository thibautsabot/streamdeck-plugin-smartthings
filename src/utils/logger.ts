/**
 * Logging that ends up in Stream Deck's own log file.
 *
 * Stream Deck ignores console.* from plugins and property inspectors, it only writes what is sent
 * through the `logMessage` event. installLogForwarding() makes every console call also go there,
 * with secrets removed, so a user can attach one log file when reporting a bug.
 */

export const PLUGIN_VERSION = '3.1.1'

const MAX_MESSAGE_LENGTH = 1500
const MAX_BODY_LENGTH = 300

const SECRET_KEYS = [
  'accesstoken',
  'refreshtoken',
  'access_token',
  'refresh_token',
  'oauthclientsecret',
  'client_secret',
  'clientsecret',
  'code_verifier',
  'codeverifier',
  'authorization',
  'code',
]

/** Remove anything that looks like a credential from free text. */
export function redactText(text: string): string {
  return text
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]')
    .replace(
      /(access_token|refresh_token|client_secret|code_verifier|code)=([^&\s"']+)/gi,
      '$1=[redacted]',
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (id) =>
        // uuids can be tokens or client ids: keep a short prefix to still tell them apart
        `${id.slice(0, 4)}…`,
    )
}

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.includes(key.toLowerCase())) return '[redacted]'
  if (typeof value === 'string' && value.length > MAX_BODY_LENGTH) {
    return `${value.slice(0, MAX_BODY_LENGTH)}…(${value.length} chars)`
  }
  return value
}

/** Error check that also works for errors created in another JS context (iframes, tests). */
function isErrorLike(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (typeof value === 'object' &&
      value !== null &&
      typeof (value as Error).message === 'string' &&
      typeof (value as Error).stack === 'string')
  )
}

function formatArg(arg: unknown): string {
  if (isErrorLike(arg)) {
    const status = (arg as { status?: number }).status
    return `${arg.name}: ${arg.message}${status ? ` (status ${status})` : ''}`
  }
  if (typeof arg === 'string') return arg
  if (arg === undefined) return 'undefined'
  if (arg === null) return 'null'
  if (typeof arg === 'object') {
    try {
      const err = arg as { status?: number; code?: string; message?: string }
      const json = JSON.stringify(arg, (key, value) => redactValue(key, value))
      return json ?? String(err.message ?? arg)
    } catch {
      return Object.prototype.toString.call(arg)
    }
  }
  return String(arg)
}

/** Build the single line sent to Stream Deck. */
export function formatLogLine(
  level: string,
  source: string,
  args: unknown[],
  now: Date = new Date(),
): string {
  const text = redactText(args.map(formatArg).join(' '))
  const clipped =
    text.length > MAX_MESSAGE_LENGTH
      ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…(${text.length} chars)`
      : text
  return `[${now.toISOString()}] ${level} ${source} ${clipped}`
}

type Sink = (message: string) => void
type Level = 'log' | 'info' | 'warn' | 'error'

const LEVEL_LABEL: Record<Level, string> = {
  log: 'INFO',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
}

/** Same line repeated within this window is collapsed (a revoked token would log every poll). */
export const REPEAT_WINDOW_MS = 5 * 60 * 1000

/**
 * Make console.log/info/warn/error also write to Stream Deck's log.
 * Identical consecutive lines are collapsed into "repeated N times" so a polling loop that
 * fails every minute cannot bury the lines that matter.
 *
 * @param sink sends one line to Stream Deck (handler.logMessage)
 * @param source 'plugin' or 'pi', to tell the two processes apart in the log
 * @param now clock, injectable for tests
 * @returns function that restores the original console methods
 */
export function installLogForwarding(
  sink: Sink,
  source: string,
  now: () => number = Date.now,
): () => void {
  const originals = {} as Record<Level, (...args: unknown[]) => void>
  let forwarding = false
  let last: { key: string; since: number; repeats: number; label: string } | null = null

  const send = (line: string) => {
    forwarding = true
    try {
      sink(line)
    } catch {
      // never let logging break the plugin
    } finally {
      forwarding = false
    }
  }

  const flushRepeats = () => {
    if (last && last.repeats > 0) {
      send(
        formatLogLine(last.label, source, [
          `(previous line repeated ${last.repeats} more times in the last ${Math.round(
            (now() - last.since) / 60000,
          )} min)`,
        ]),
      )
    }
  }

  ;(['log', 'info', 'warn', 'error'] as Level[]).forEach((level) => {
    originals[level] = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      originals[level](...args)
      if (forwarding) return

      const label = LEVEL_LABEL[level]
      const key = `${label}|${redactText(args.map(formatArg).join(' '))}`
      const time = now()

      if (last && last.key === key && time - last.since < REPEAT_WINDOW_MS) {
        last.repeats++
        return
      }

      flushRepeats()
      last = { key, since: time, repeats: 0, label }
      send(formatLogLine(label, source, args))
    }
  })

  return () => {
    flushRepeats()
    ;(Object.keys(originals) as Level[]).forEach((level) => {
      console[level] = originals[level]
    })
  }
}

/**
 * Log uncaught errors and rejected promises, with a stack trace. Without this a crash only shows
 * up in Stream Deck's log as "Process stopped", with no cause.
 * @returns function that removes the listeners
 */
export function installCrashLogging(target: EventTarget): () => void {
  const onError = (event: Event) => {
    const e = event as unknown as { message?: string; error?: Error }
    console.error(`Uncaught error: ${e.message ?? 'unknown'}`, e.error?.stack ?? '')
  }
  const onRejection = (event: Event) => {
    const reason = (event as unknown as { reason?: unknown }).reason
    console.error(
      'Unhandled promise rejection:',
      isErrorLike(reason) ? `${reason.message}\n${reason.stack ?? ''}` : reason,
    )
  }

  target.addEventListener('error', onError)
  target.addEventListener('unhandledrejection', onRejection)

  return () => {
    target.removeEventListener('error', onError)
    target.removeEventListener('unhandledrejection', onRejection)
  }
}

interface SettingsLike {
  oauthClientId?: string
  oauthClientSecret?: string
  oauthTokens?: { accessToken?: string; refreshToken?: string; expiresAt?: number }
}

/** One-line description of the global settings without any secret value. */
export function describeGlobalSettings(settings: unknown, now: number = Date.now()): string {
  if (settings === undefined || settings === null) return 'settings=undefined'
  const s = settings as SettingsLike
  const keys = Object.keys(s)
  if (keys.length === 0) return 'settings=empty'

  const tokens = s.oauthTokens
  const expiresIn =
    tokens?.expiresAt !== undefined
      ? `${((tokens.expiresAt - now) / 3600000).toFixed(1)}h`
      : 'unknown'

  return [
    `keys=[${keys.join(',')}]`,
    `clientId=${s.oauthClientId ? 'yes' : 'no'}`,
    `clientSecret=${s.oauthClientSecret ? 'yes' : 'no'}`,
    `accessToken=${tokens?.accessToken ? 'yes' : 'no'}`,
    `refreshToken=${tokens?.refreshToken ? 'yes' : 'no'}`,
    `accessTokenExpiresIn=${expiresIn}`,
  ].join(' ')
}
