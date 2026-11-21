import { PluginTokenClient, TokenRequestError } from '../pi-token-client'
import { AuthStatusRequestMessage, TokenRequestMessage } from '../plugin-token'

describe('PluginTokenClient', () => {
  let sent: Array<TokenRequestMessage | AuthStatusRequestMessage>
  let client: PluginTokenClient

  beforeEach(() => {
    jest.useFakeTimers()
    sent = []
    client = new PluginTokenClient((message) => sent.push(message), 1000, 500)
  })

  afterEach(() => jest.useRealTimers())

  it('resolves with the token from the matching reply', async () => {
    const promise = client.request()

    expect(sent).toHaveLength(1)
    expect(sent[0].event).toBe('getToken')
    client.handleMessage({ event: 'token', requestId: sent[0].requestId, accessToken: 'abc' })

    await expect(promise).resolves.toBe('abc')
  })

  it('sends the rejected access token to force a refresh', () => {
    client.request('old-token').catch(() => undefined)

    expect((sent[0] as TokenRequestMessage).rejectedAccessToken).toBe('old-token')
    jest.advanceTimersByTime(1000)
  })

  it('rejects with the error reported by the plugin', async () => {
    const promise = client.request()
    client.handleMessage({ event: 'token', requestId: sent[0].requestId, error: 'auth_revoked' })

    await expect(promise).rejects.toMatchObject({ reason: 'auth_revoked' })
  })

  it('defaults to refresh_failed when the reply has no token and no error', async () => {
    const promise = client.request()
    client.handleMessage({ event: 'token', requestId: sent[0].requestId })

    await expect(promise).rejects.toBeInstanceOf(TokenRequestError)
    await expect(promise).rejects.toMatchObject({ reason: 'refresh_failed' })
  })

  it('rejects with a timeout when the plugin never answers', async () => {
    const promise = client.request()
    jest.advanceTimersByTime(1000)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
  })

  it('keeps concurrent requests apart', async () => {
    const first = client.request()
    const second = client.request()
    expect(sent[0].requestId).not.toBe(sent[1].requestId)

    client.handleMessage({ event: 'token', requestId: sent[1].requestId, accessToken: 'two' })
    client.handleMessage({ event: 'token', requestId: sent[0].requestId, accessToken: 'one' })

    await expect(first).resolves.toBe('one')
    await expect(second).resolves.toBe('two')
  })

  it('ignores messages that are not token replies', () => {
    expect(client.handleMessage(undefined)).toBe(false)
    expect(client.handleMessage({ event: 'other' as never })).toBe(false)
    expect(client.handleMessage({ event: 'token' })).toBe(false)
  })

  it('swallows a late reply for a request that already timed out', async () => {
    const promise = client.request()
    const requestId = sent[0].requestId
    jest.advanceTimersByTime(1000)
    await expect(promise).rejects.toBeDefined()

    expect(client.handleMessage({ event: 'token', requestId, accessToken: 'late' })).toBe(true)
  })

  it('uses the default timeout when none is given', async () => {
    const defaultClient = new PluginTokenClient((message) => sent.push(message))
    const promise = defaultClient.request()
    jest.advanceTimersByTime(10000)

    await expect(promise).rejects.toMatchObject({ reason: 'timeout' })
  })

  describe('requestAuthStatus', () => {
    it('resolves with what the plugin says', async () => {
      const promise = client.requestAuthStatus()

      expect(sent[0].event).toBe('getAuthStatus')
      client.handleMessage({
        event: 'authStatus',
        requestId: sent[0].requestId,
        signedIn: true,
        clientId: 'id',
        clientSecret: 'secret',
      })

      await expect(promise).resolves.toEqual({
        signedIn: true,
        clientId: 'id',
        clientSecret: 'secret',
      })
    })

    it('resolves with null when the plugin does not answer in time', async () => {
      const promise = client.requestAuthStatus()
      jest.advanceTimersByTime(500)

      await expect(promise).resolves.toBeNull()
    })
  })
})
