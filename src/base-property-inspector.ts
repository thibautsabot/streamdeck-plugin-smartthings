import {
  SDOnPiEvent,
  StreamDeckPropertyInspectorHandler,
  DidReceiveSettingsEvent,
} from 'streamdeck-typescript'
import { isGlobalSettingsSet, addSelectOption, SelectElement } from './utils/index'
import { GlobalSettingsInterface } from './utils/interface'
import { SmartThingsOAuthClient } from './utils/oauth-client'

export abstract class BasePropertyInspector<TSettings> extends StreamDeckPropertyInspectorHandler {
  protected selectOptions?: SelectElement[]
  protected selectedOptionId = ''
  protected oauthClient?: SmartThingsOAuthClient
  protected oauthState?: { codeVerifier: string; state: string }
  protected isAuthenticating = false

  constructor() {
    super()
  }

  @SDOnPiEvent('documentLoaded')
  onDocumentLoaded(): void {
    // Inject OAuth UI at the top of mainSettings
    this.injectOAuthUI()

    const oauthButton = document.getElementById('oauth_button') as HTMLButtonElement
    const submitCodeButton = document.getElementById('submit_code_button') as HTMLButtonElement
    const signOutButton = document.getElementById('sign_out_button') as HTMLButtonElement
    const select = document.getElementById('select_value') as HTMLSelectElement

    oauthButton?.addEventListener('click', this.onOAuthButtonPressed.bind(this))
    submitCodeButton?.addEventListener('click', this.onSubmitCodePressed.bind(this))
    signOutButton?.addEventListener('click', this.onSignOutButtonPressed.bind(this))
    select?.addEventListener('change', this.onSelectChanged.bind(this))

    addSelectOption({ select, element: { id: 'none', name: this.getDefaultOptionLabel() } })

    this.onDocumentLoadedExtended()
  }

  protected onDocumentLoadedExtended(): void {}

  private injectOAuthUI(): void {
    const mainSettings = document.getElementById('mainSettings')
    if (!mainSettings) return

    const oauthHTML = `
      <!-- Authentication Status (shown when authenticated) -->
      <div id="auth_status_banner" style="display: none;">
        <div class="auth-status">
          <span><span class="auth-status-icon">✓</span>Connected to SmartThings</span>
          <button class="sign-out-btn" id="sign_out_button">Sign Out</button>
        </div>
      </div>

      <!-- OAuth Setup Section (shown when not authenticated) -->
      <div id="oauth_section">
        <div class="sdpi-item">
          <div class="sdpi-item-label">Client ID</div>
          <input class="sdpi-item-value" type="text" id="oauth_client_id" placeholder="Enter your SmartThings Client ID">
        </div>
        <div class="sdpi-item">
          <div class="sdpi-item-label">Client Secret</div>
          <input class="sdpi-item-value" type="password" id="oauth_client_secret" placeholder="Enter your Client Secret">
        </div>
        <div class="sdpi-item">
          <div class="sdpi-item-label">Step 1</div>
          <button class="sdpi-item-value" id="oauth_button">Open Authorization Page</button>
        </div>
        <div class="sdpi-item" id="code_input_section" style="display: none;">
          <div class="sdpi-item-label">Step 2</div>
          <input class="sdpi-item-value" type="text" id="oauth_code" placeholder="Paste authorization code here">
        </div>
        <div class="sdpi-item" id="submit_code_section" style="display: none;">
          <div class="sdpi-item-label">&nbsp;</div>
          <button class="sdpi-item-value" id="submit_code_button">Complete Authorization</button>
        </div>
      </div>
    `

    // Insert at the beginning of mainSettings
    mainSettings.insertAdjacentHTML('afterbegin', oauthHTML)
  }

  @SDOnPiEvent('globalSettingsAvailable')
  async propertyInspectorDidAppear(): Promise<void> {
    this.requestSettings()
    const globalSettings = this.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (isGlobalSettingsSet(globalSettings)) {
      // User is authenticated - show status banner, hide OAuth form
      this.showAuthenticatedUI()

      // Pre-fill credentials (hidden) for re-authentication if needed
      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement
      if (clientIdInput) clientIdInput.value = globalSettings.oauthClientId
      if (clientSecretInput) clientSecretInput.value = globalSettings.oauthClientSecret

      // Fetch devices/scenes for this button type
      try {
        const accessToken = await this.getAccessToken(globalSettings)
        if (!accessToken) {
          console.error('[PropertyInspector] Failed to get valid access token')
          return
        }
        const elements = await this.fetchOptions(accessToken)
        this.selectOptions = elements
        this.populateDropdown()
      } catch (error) {
        const apiError = error as { status?: number }
        console.error('[PropertyInspector] Failed to fetch options:', apiError)

        // If we get a 401, the token might be invalid even though it appears valid locally
        // Try to refresh it
        if (apiError.status === 401) {
          const oauthClient = new SmartThingsOAuthClient(
            globalSettings.oauthClientId,
            globalSettings.oauthClientSecret
          )
          const refreshedToken = await this.refreshAccessToken(globalSettings, oauthClient)

          if (refreshedToken) {
            try {
              const elements = await this.fetchOptions(refreshedToken)
              this.selectOptions = elements
              this.populateDropdown()
              return
            } catch (retryError) {
              console.error('[PropertyInspector] Failed after token refresh:', retryError)
            }
          }
          alert('Your session is no longer valid. Please sign out and sign in again.')
          this.showUnauthenticatedUI()
        }
      }
    } else {
      // User is not authenticated - show OAuth form, hide status banner
      this.showUnauthenticatedUI()
    }
  }

  protected async onOAuthButtonPressed() {
    if (this.isAuthenticating) return

    const clientId = (<HTMLInputElement>document.getElementById('oauth_client_id'))?.value
    const clientSecret = (<HTMLInputElement>document.getElementById('oauth_client_secret'))?.value

    if (!clientId || !clientSecret) {
      alert('Please enter both Client ID and Client Secret')
      return
    }

    try {
      this.oauthClient = new SmartThingsOAuthClient(clientId, clientSecret)

      const { url: authUrl, codeVerifier, state } = await this.oauthClient.getAuthorizationUrl()
      this.oauthState = { codeVerifier, state }

      window.open(authUrl, '_blank')

      const codeInputSection = document.getElementById('code_input_section')
      const submitCodeSection = document.getElementById('submit_code_section')

      if (codeInputSection) codeInputSection.style.display = ''
      if (submitCodeSection) submitCodeSection.style.display = ''
    } catch (error) {
      console.error('[OAuth] Failed to get authorization URL:', error)
      alert(`Failed to start OAuth flow: ${error}`)
    }
  }

  protected async onSubmitCodePressed() {
    if (this.isAuthenticating) return

    const authCodeInput = document.getElementById('oauth_code') as HTMLInputElement
    const authCode = authCodeInput?.value?.trim()

    if (!authCode) {
      alert('Please paste the authorization code')
      return
    }

    if (!this.oauthClient || !this.oauthState) {
      alert('OAuth session expired. Please click "Open Authorization Page" again.')
      return
    }

    this.isAuthenticating = true
    const submitButton = document.getElementById('submit_code_button') as HTMLButtonElement
    if (submitButton) submitButton.disabled = true

    try {
      const clientId = (<HTMLInputElement>document.getElementById('oauth_client_id'))?.value
      const clientSecret = (<HTMLInputElement>document.getElementById('oauth_client_secret'))?.value

      // Exchange code for tokens using PKCE verifier
      const tokens = await this.oauthClient.exchangeCodeForToken(
        authCode,
        this.oauthState.codeVerifier,
      )

      // Save OAuth credentials
      this.settingsManager.setGlobalSettings<GlobalSettingsInterface>({
        oauthTokens: tokens,
        oauthClientId: clientId,
        oauthClientSecret: clientSecret,
      })

      // Show authenticated UI
      this.showAuthenticatedUI()

      // Fetch devices/scenes with new token
      const elements = await this.fetchOptions(tokens.accessToken)
      this.selectOptions = elements
      this.populateDropdown()
    } catch (error) {
      console.error('[OAuth] Token exchange failed:', error)
      alert(`Authentication failed: ${error}`)

      // Reset UI to allow retry
      const submitButton = document.getElementById('submit_code_button') as HTMLButtonElement
      if (submitButton) submitButton.disabled = false
    } finally {
      this.isAuthenticating = false
    }
  }

  protected onSignOutButtonPressed() {
    if (!confirm('Are you sure you want to sign out? You will need to re-authorize.')) {
      return
    }

    // Clear OAuth credentials by setting to undefined
    // StreamDeck will handle this as clearing the settings
    this.settingsManager.setGlobalSettings(undefined)

    // Show unauthenticated UI
    this.showUnauthenticatedUI()

    // Clear device/scene selection
    this.selectOptions = []
    const select = document.getElementById('select_value') as HTMLSelectElement
    if (select) {
      select.length = 1 // Keep only the default "No device/scene" option
    }
  }

  protected showAuthenticatedUI() {
    const authBanner = document.getElementById('auth_status_banner')
    const oauthSection = document.getElementById('oauth_section')

    if (authBanner) authBanner.style.display = 'block'
    if (oauthSection) oauthSection.style.display = 'none'
  }

  protected showUnauthenticatedUI() {
    const authBanner = document.getElementById('auth_status_banner')
    const oauthSection = document.getElementById('oauth_section')

    if (authBanner) authBanner.style.display = 'none'
    if (oauthSection) oauthSection.style.display = 'block'
  }

  /**
   * Get a valid access token, refreshing if necessary
   * Automatically updates global settings if token was refreshed
   */
  protected async getAccessToken(globalSettings: GlobalSettingsInterface): Promise<string | null> {
    const oauthClient = new SmartThingsOAuthClient(
      globalSettings.oauthClientId,
      globalSettings.oauthClientSecret
    )

    // Check if token needs refresh based on expiry time
    if (oauthClient.isTokenExpired(globalSettings.oauthTokens)) {
      return this.refreshAccessToken(globalSettings, oauthClient)
    }

    return globalSettings.oauthTokens.accessToken
  }

  /**
   * Refresh the access token using the refresh token
   */
  private async refreshAccessToken(
    globalSettings: GlobalSettingsInterface,
    oauthClient: SmartThingsOAuthClient
  ): Promise<string | null> {
    try {
      const newTokens = await oauthClient.refreshToken(globalSettings.oauthTokens.refreshToken)

      this.settingsManager.setGlobalSettings<GlobalSettingsInterface>({
        ...globalSettings,
        oauthTokens: newTokens,
      })

      return newTokens.accessToken
    } catch (error) {
      console.error('[PropertyInspector] Token refresh failed:', error)
      return null
    }
  }

  protected updateOAuthButtonState() {
    const oauthButton = document.getElementById('oauth_button') as HTMLButtonElement
    if (oauthButton) {
      oauthButton.disabled = this.isAuthenticating
      oauthButton.textContent = this.isAuthenticating ? 'Connecting...' : 'Connect to SmartThings'
    }
  }

  protected populateDropdown(): void {
    const select = document.getElementById('select_value') as HTMLSelectElement
    if (!select || !this.selectOptions) return

    select.length = 1

    this.selectOptions.forEach((element) => addSelectOption({ select, element }))
  }

  protected async onSelectChanged(e: Event) {
    const newSelection = (e.target as HTMLSelectElement).value
    this.selectedOptionId = newSelection
    this.saveSettings()
  }

  protected selectOptionInDropdown(id: string): void {
    const activeIndex = this.selectOptions?.findIndex((element) => element.id === id)
    const select = document.getElementById('select_value') as HTMLSelectElement
    if (select) {
      select.selectedIndex = activeIndex !== undefined && activeIndex >= 0 ? activeIndex + 1 : 0
    }
  }

  protected abstract getDefaultOptionLabel(): string
  protected abstract fetchOptions(accessToken: string): Promise<SelectElement[]>
  protected abstract saveSettings(): void
  abstract onReceiveSettings(event: DidReceiveSettingsEvent<TSettings>): void
}
