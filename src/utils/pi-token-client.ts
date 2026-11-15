/**
 * Property inspector side of the token bridge: asks the plugin for an access token and
 * waits for its reply. The plugin is the only process allowed to refresh tokens.
 */

import { TokenRequestMessage, TokenResponseMessage } from './plugin-token'

export const TOKEN_REQUEST_TIMEOUT_MS = 10000

export class TokenRequestError extends Error {
  constructor(public readonly reason: NonNullable<TokenResponseMessage['error']> | 'timeout') {
    super(`Token request failed: ${reason}`)
  }
}

interface Pending {
  resolve: (accessToken: string) => void
  reject: (error: TokenRequestError) => void
  timer: ReturnType<typeof setTimeout>
}

export class PluginTokenClient {
  private pending = new Map<string, Pending>()
  private counter = 0

  constructor(
    private send: (message: TokenRequestMessage) => void,
    private timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
  ) {}

  /**
   * Ask the plugin for a valid access token.
   * @param rejectedAccessToken token the API answered 401 for, forces a refresh
   */
  public request(rejectedAccessToken?: string): Promise<string> {
    const requestId = `${Date.now()}-${++this.counter}`

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new TokenRequestError('timeout'))
      }, this.timeoutMs)

      this.pending.set(requestId, { resolve, reject, timer })
      this.send({ event: 'getToken', requestId, rejectedAccessToken })
    })
  }

  /**
   * Feed every message received from the plugin here. Returns true if it was a token reply.
   */
  public handleMessage(payload: Partial<TokenResponseMessage> | undefined): boolean {
    if (!payload || payload.event !== 'token' || !payload.requestId) return false

    const pending = this.pending.get(payload.requestId)
    if (!pending) return true

    clearTimeout(pending.timer)
    this.pending.delete(payload.requestId)

    if (payload.accessToken) {
      pending.resolve(payload.accessToken)
    } else {
      pending.reject(new TokenRequestError(payload.error ?? 'refresh_failed'))
    }
    return true
  }
}
