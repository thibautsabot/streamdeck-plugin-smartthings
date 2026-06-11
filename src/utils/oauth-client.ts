/**
 * OAuth2 client for SmartThings authentication
 * Uses client-oauth2 for OAuth flow and oauth-pkce for PKCE generation
 */

import ClientOAuth2 from 'client-oauth2'
import getPkce from 'oauth-pkce'

/**
 * PKCE pair for OAuth flow
 */
interface PKCEPair {
  codeVerifier: string
  codeChallenge: string
}

/**
 * Generate PKCE verifier and challenge
 */
function generatePKCEPair(): Promise<PKCEPair> {
  return new Promise((resolve, reject) => {
    getPkce(43, (error, result) => {
      if (error) {
        reject(error)
      } else {
        resolve({
          codeVerifier: result.verifier,
          codeChallenge: result.challenge,
        })
      }
    })
  })
}

/**
 * OAuth token format
 */
export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in milliseconds
  tokenType: string
}

/**
 * SmartThings OAuth2 client with PKCE support
 */
export class SmartThingsOAuthClient {
  private client: ClientOAuth2
  private redirectUri: string

  constructor(clientId: string, clientSecret: string) {
    this.redirectUri = 'https://streamdeck-smartthings-oauth.vercel.app/oauth-callback.html'

    this.client = new ClientOAuth2({
      clientId,
      clientSecret,
      accessTokenUri: 'https://api.smartthings.com/oauth/token',
      authorizationUri: 'https://api.smartthings.com/oauth/authorize',
      redirectUri: this.redirectUri,
      scopes: ['r:devices:*', 'x:devices:*', 'r:scenes:*', 'x:scenes:*'],
    })
  }

  /**
   * Generate authorization URL with PKCE
   */
  public async getAuthorizationUrl(): Promise<{
    url: string
    codeVerifier: string
    state: string
  }> {
    const { codeVerifier, codeChallenge } = await generatePKCEPair()
    const state = this.generateState()

    // Use client-oauth2 to build URL, pass PKCE params via query
    const url = this.client.code.getUri({
      state,
      query: {
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      },
    })

    return { url, codeVerifier, state }
  }

  /**
   * Exchange authorization code for tokens using PKCE
   */
  public async exchangeCodeForToken(code: string, codeVerifier: string): Promise<OAuthTokens> {
    try {
      // Use client-oauth2 to exchange code, pass PKCE verifier via body
      // Note: We reconstruct the redirect URL with the code parameter
      const token = await this.client.code.getToken(this.redirectUri + `?code=${code}`, {
        body: {
          code_verifier: codeVerifier,
        },
      })

      return this.convertToken(token)
    } catch (error: unknown) {
      const err = error as { body?: { error_description?: string }; message?: string }
      throw new Error(err.body?.error_description || err.message || 'Token exchange failed')
    }
  }

  /**
   * Refresh access token
   */
  public async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    // Recreate token instance from refresh token
    const token = this.client.createToken({ refresh_token: refreshToken })
    const refreshed = await token.refresh()

    return this.convertToken(refreshed)
  }

  /**
   * Check if token is expired (within 5 minutes)
   */
  public isTokenExpired(tokens: OAuthTokens): boolean {
    if (!tokens.expiresAt) return false
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000
    return tokens.expiresAt < fiveMinutesFromNow
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Convert client-oauth2 token to our format
   */
  private convertToken(token: ClientOAuth2.Token): OAuthTokens {
    // Calculate expiry time from expiresIn (seconds)
    const expiresInSeconds = token.data.expires_in
    const expiresAt = expiresInSeconds ? Date.now() + Number(expiresInSeconds) * 1000 : 0

    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken || '',
      expiresAt,
      tokenType: token.tokenType || 'Bearer',
    }
  }
}
