import 'isomorphic-fetch'
import { SmartThingsOAuthClient } from '../oauth-client'

interface PKCEResult {
  verifier: string
  challenge: string
}

// We need to mock oauth-pkce to test the error path
jest.mock('oauth-pkce', () => {
  return jest.fn()
})

describe('SmartThingsOAuthClient PKCE Error', () => {
  let client: SmartThingsOAuthClient

  beforeEach(() => {
    jest.clearAllMocks()
    client = new SmartThingsOAuthClient('test-client-id', 'test-client-secret')
  })

  it('should handle PKCE generation errors', async () => {
    const getPkce = require('oauth-pkce') as jest.Mock

    // Mock PKCE to return an error
    getPkce.mockImplementation((length: number, callback: (error: Error | null, result: PKCEResult | null) => void) => {
      callback(new Error('PKCE generation failed'), null)
    })

    await expect(client.getAuthorizationUrl()).rejects.toThrow('PKCE generation failed')
  })

  it('should succeed when PKCE works', async () => {
    const getPkce = require('oauth-pkce') as jest.Mock

    // Mock PKCE to succeed
    getPkce.mockImplementation((length: number, callback: (error: Error | null, result: PKCEResult | null) => void) => {
      callback(null, {
        verifier: 'test-verifier',
        challenge: 'test-challenge',
      })
    })

    const result = await client.getAuthorizationUrl()

    expect(result.codeVerifier).toBe('test-verifier')
    expect(result.url).toContain('test-challenge')
  })
})
