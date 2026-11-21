/**
 * Property inspector side of the plugin bridge: asks the plugin for an access token or for the
 * sign-in status and waits for its reply. The plugin is the only process allowed to refresh
 * tokens, and the one that knows whether a session exists.
 */

import {
  AuthStatusRequestMessage,
  AuthStatusResponseMessage,
  TokenRequestMessage,
  TokenResponseMessage,
} from './plugin-token'

export const TOKEN_REQUEST_TIMEOUT_MS = 10000
export const AUTH_STATUS_TIMEOUT_MS = 3000

export class TokenRequestError extends Error {
  constructor(public readonly reason: NonNullable<TokenResponseMessage['error']> | 'timeout') {
    super(`Token request failed: ${reason}`)
  }
}

export type AuthStatus = Pick<AuthStatusResponseMessage, 'signedIn' | 'clientId' | 'clientSecret'>

interface Pending {
  resolve: (accessToken: string) => void
  reject: (error: TokenRequestError) => void
  timer: ReturnType<typeof setTimeout>
}

interface PendingStatus {
  resolve: (status: AuthStatus | null) => void
  timer: ReturnType<typeof setTimeout>
}

type PluginReply = Partial<TokenResponseMessage> | Partial<AuthStatusResponseMessage>

export class PluginTokenClient {
  private pending = new Map<string, Pending>()
  private pendingStatus = new Map<string, PendingStatus>()
  private counter = 0

  constructor(
    private send: (message: TokenRequestMessage | AuthStatusRequestMessage) => void,
    private timeoutMs: number = TOKEN_REQUEST_TIMEOUT_MS,
    private statusTimeoutMs: number = AUTH_STATUS_TIMEOUT_MS,
  ) {}

  /**
   * Ask the plugin for a valid access token.
   * @param rejectedAccessToken token the API answered 401 for, forces a refresh
   */
  public request(rejectedAccessToken?: string): Promise<string> {
    const requestId = this.nextId()

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
   * Ask the plugin whether a session exists. Resolves with null when the plugin does not
   * answer in time, so the caller can fall back to what it knows itself.
   */
  public requestAuthStatus(): Promise<AuthStatus | null> {
    const requestId = this.nextId()

    return new Promise<AuthStatus | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingStatus.delete(requestId)
        resolve(null)
      }, this.statusTimeoutMs)

      this.pendingStatus.set(requestId, { resolve, timer })
      this.send({ event: 'getAuthStatus', requestId })
    })
  }

  /**
   * Feed every message received from the plugin here. Returns true if it was a reply we handle.
   */
  public handleMessage(payload: PluginReply | undefined): boolean {
    if (!payload || !payload.requestId) return false

    if (payload.event === 'authStatus') {
      return this.handleStatusReply(payload as Partial<AuthStatusResponseMessage>)
    }
    if (payload.event !== 'token') return false

    const reply = payload as Partial<TokenResponseMessage>
    const pending = this.pending.get(payload.requestId)
    if (!pending) return true

    clearTimeout(pending.timer)
    this.pending.delete(payload.requestId)

    if (reply.accessToken) {
      pending.resolve(reply.accessToken)
    } else {
      pending.reject(new TokenRequestError(reply.error ?? 'refresh_failed'))
    }
    return true
  }

  private handleStatusReply(reply: Partial<AuthStatusResponseMessage>): boolean {
    const pending = this.pendingStatus.get(reply.requestId ?? '')
    if (!pending) return true

    clearTimeout(pending.timer)
    this.pendingStatus.delete(reply.requestId ?? '')
    pending.resolve({
      signedIn: reply.signedIn === true,
      clientId: reply.clientId,
      clientSecret: reply.clientSecret,
    })
    return true
  }

  private nextId(): string {
    return `${Date.now()}-${++this.counter}`
  }
}
