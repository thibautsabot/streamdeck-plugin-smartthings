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
    const signOutButton = document.getElementById('sign_out_button') as HTMLButtonElement
    const select = document.getElementById('select_value') as HTMLSelectElement

    oauthButton?.addEventListener('click', this.onOAuthButtonPressed.bind(this))
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
          <div class="sdpi-item-label">Authorize</div>
          <button class="sdpi-item-value" id="oauth_button">Connect to SmartThings</button>
        </div>
      </div>
    `

    // Insert at the beginning of mainSettings
    mainSettings.insertAdjacentHTML('afterbegin', oauthHTML)
  }

  @SDOnPiEvent('globalSettingsAvailable')
  propertyInspectorDidAppear(): void {
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

    this.isAuthenticating = true
    this.updateOAuthButtonState()

    try {
      // Initialize OAuth client
      this.oauthClient = new SmartThingsOAuthClient(clientId, clientSecret)

      // Step 1: Get authorization URL and open it
      const { url: authUrl, codeVerifier, state } = await this.oauthClient.getAuthorizationUrl()
      this.oauthState = { codeVerifier, state }

      // Open in browser
      window.open(authUrl, '_blank')

      // Step 2: Show instructions and wait for user to paste the authorization code
      const instructions =
        'After authorizing in your browser:\n\n' +
        '1. You will see an error page (localhost:8888 cannot be reached)\n' +
        '2. Look at the URL bar - it contains your authorization code\n' +
        '3. Copy the ENTIRE URL from the address bar\n' +
        '4. Paste it below\n\n' +
        'The URL looks like:\n' +
        'http://localhost:8888/callback?code=ABC123&state=XYZ'

      const redirectUrl = prompt(instructions)
      if (!redirectUrl || !this.oauthState) {
        this.oauthClient = undefined
        this.oauthState = undefined
        return
      }

      // Parse the redirect URL to extract code and state
      let url: URL
      try {
        const urlToParse = redirectUrl.trim().startsWith('http')
          ? redirectUrl.trim()
          : `http://localhost:8888${redirectUrl.trim()}`
        url = new URL(urlToParse)
      } catch {
        throw new Error('Invalid URL. Please paste the entire URL from your browser address bar.')
      }

      const authCode = url.searchParams.get('code')
      const receivedState = url.searchParams.get('state')

      if (!authCode || !receivedState) {
        throw new Error(
          'URL is missing code or state parameter. Please paste the complete redirect URL.',
        )
      }

      // Validate state (CSRF protection)
      if (receivedState !== this.oauthState.state) {
        throw new Error('Invalid state parameter. Possible CSRF attack.')
      }

      // Step 3: Exchange code for tokens using PKCE verifier
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
      console.error('[OAuth] Authorization failed:', error)
      alert(`OAuth authentication failed: ${error}`)
      this.showUnauthenticatedUI()
    } finally {
      this.isAuthenticating = false
      this.updateOAuthButtonState()
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
