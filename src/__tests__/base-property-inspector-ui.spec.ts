import 'isomorphic-fetch'
import { BasePropertyInspector } from '../base-property-inspector'
import { GlobalSettingsInterface } from '../utils/interface'
import { SmartThingsOAuthClient } from '../utils/oauth-client'

// Mock the OAuth client
jest.mock('../utils/oauth-client')

// Mock window methods
global.open = jest.fn()
global.alert = jest.fn()
global.confirm = jest.fn(() => true)

// Create a test class
class TestPropertyInspector extends BasePropertyInspector<any> {
  public mockSettingsManager = {
    setGlobalSettings: jest.fn(),
    getGlobalSettings: jest.fn(),
  }

  public mockSetSettings = jest.fn()

  get settingsManager(): any {
    return this.mockSettingsManager
  }

  protected getDefaultOptionLabel(): string {
    return 'No device selected'
  }

  protected async fetchOptions(accessToken: string): Promise<any[]> {
    return [
      { id: 'device-1', name: 'Living Room' },
      { id: 'device-2', name: 'Bedroom' },
    ]
  }

  protected saveSettings(): void {
    this.mockSetSettings()
  }

  setSettings(settings: any): void {
    this.mockSetSettings(settings)
  }

  requestSettings(): void {}

  onReceiveSettings(event: any): void {}
}

describe('BasePropertyInspector UI', () => {
  let inspector: TestPropertyInspector
  let mockOAuthClient: jest.Mocked<SmartThingsOAuthClient>

  const validGlobalSettings: GlobalSettingsInterface = {
    oauthTokens: {
      accessToken: 'valid-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: Date.now() + 3600000,
      tokenType: 'Bearer',
    },
    oauthClientId: 'test-client-id',
    oauthClientSecret: 'test-client-secret',
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup DOM
    document.body.innerHTML = `
      <div id="mainSettings">
        <select id="select_value"></select>
      </div>
    `

    mockOAuthClient = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      isTokenExpired: jest.fn(),
      refreshToken: jest.fn(),
    } as any

    ;(SmartThingsOAuthClient as jest.MockedClass<typeof SmartThingsOAuthClient>).mockImplementation(
      () => mockOAuthClient
    )

    inspector = new TestPropertyInspector()
    inspector.mockSettingsManager.getGlobalSettings.mockReturnValue({})
  })

  describe('onDocumentLoaded', () => {
    it('should inject OAuth UI into DOM', () => {
      inspector.onDocumentLoaded()

      expect(document.getElementById('oauth_button')).toBeTruthy()
      expect(document.getElementById('submit_code_button')).toBeTruthy()
      expect(document.getElementById('sign_out_button')).toBeTruthy()
      expect(document.getElementById('oauth_client_id')).toBeTruthy()
      expect(document.getElementById('oauth_client_secret')).toBeTruthy()
      expect(document.getElementById('auth_status_banner')).toBeTruthy()
      expect(document.getElementById('oauth_section')).toBeTruthy()
    })

    it('should add default option to select', () => {
      inspector.onDocumentLoaded()

      const select = document.getElementById('select_value') as HTMLSelectElement
      expect(select.options.length).toBe(1)
      expect(select.options[0].text).toBe('No device selected')
    })

    it('should return early if mainSettings not found', () => {
      document.body.innerHTML = '<div><select id="select_value"></select></div>'
      inspector.onDocumentLoaded()
      expect(document.getElementById('oauth_button')).toBeFalsy()
    })
  })

  describe('onOAuthButtonPressed', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should alert if client ID missing', async () => {
      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      clientIdInput.value = ''

      const button = document.getElementById('oauth_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.alert).toHaveBeenCalledWith('Please enter both Client ID and Client Secret')
    })

    it('should alert if client secret missing', async () => {
      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      clientIdInput.value = 'client-id'

      const button = document.getElementById('oauth_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.alert).toHaveBeenCalledWith('Please enter both Client ID and Client Secret')
    })

    it('should open authorization URL', async () => {
      mockOAuthClient.getAuthorizationUrl.mockResolvedValue({
        url: 'https://oauth.url',
        codeVerifier: 'verifier-123',
        state: 'state-456',
      })

      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement
      clientIdInput.value = 'client-id'
      clientSecretInput.value = 'client-secret'

      const button = document.getElementById('oauth_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.open).toHaveBeenCalledWith('https://oauth.url', '_blank')
      expect(document.getElementById('code_input_section')?.style.display).toBe('')
      expect(document.getElementById('submit_code_section')?.style.display).toBe('')
    })

    it('should handle errors when getting auth URL', async () => {
      mockOAuthClient.getAuthorizationUrl.mockRejectedValue(new Error('Network error'))

      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement
      clientIdInput.value = 'client-id'
      clientSecretInput.value = 'client-secret'

      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      const button = document.getElementById('oauth_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.alert).toHaveBeenCalledWith('Failed to start OAuth flow: Error: Network error')
      consoleError.mockRestore()
    })
  })

  describe('onSubmitCodePressed', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
      inspector['oauthState'] = { codeVerifier: 'verifier-123', state: 'state-456' }
      inspector['oauthClient'] = mockOAuthClient
    })

    it('should alert if no code entered', async () => {
      const button = document.getElementById('submit_code_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.alert).toHaveBeenCalledWith('Please paste the authorization code')
    })

    it('should alert if OAuth session expired', async () => {
      inspector['oauthClient'] = undefined

      const codeInput = document.getElementById('oauth_code') as HTMLInputElement
      codeInput.value = 'auth-code-123'

      const button = document.getElementById('submit_code_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(global.alert).toHaveBeenCalledWith(
        'OAuth session expired. Please click "Open Authorization Page" again.'
      )
    })

    it('should exchange code for tokens and fetch devices', async () => {
      mockOAuthClient.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: Date.now() + 3600000,
        tokenType: 'Bearer',
      })

      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement
      const codeInput = document.getElementById('oauth_code') as HTMLInputElement

      clientIdInput.value = 'client-id'
      clientSecretInput.value = 'client-secret'
      codeInput.value = 'auth-code-123'

      const button = document.getElementById('submit_code_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockOAuthClient.exchangeCodeForToken).toHaveBeenCalledWith(
        'auth-code-123',
        'verifier-123'
      )
      expect(inspector.mockSettingsManager.setGlobalSettings).toHaveBeenCalled()
    })

    it('should handle token exchange errors', async () => {
      mockOAuthClient.exchangeCodeForToken.mockRejectedValue(new Error('Invalid code'))

      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement
      const codeInput = document.getElementById('oauth_code') as HTMLInputElement

      clientIdInput.value = 'client-id'
      clientSecretInput.value = 'client-secret'
      codeInput.value = 'invalid-code'

      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      const button = document.getElementById('submit_code_button') as HTMLButtonElement
      button.click()

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(global.alert).toHaveBeenCalledWith('Authentication failed: Error: Invalid code')
      consoleError.mockRestore()
    })
  })

  describe('onSignOutButtonPressed', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
      inspector['selectOptions'] = [{ id: 'device-1', name: 'Device 1' }]
    })

    it('should clear settings when confirmed', () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)

      const button = document.getElementById('sign_out_button') as HTMLButtonElement
      button.click()

      expect(inspector.mockSettingsManager.setGlobalSettings).toHaveBeenCalledWith(undefined)
    })

    it('should not clear settings when cancelled', () => {
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      const button = document.getElementById('sign_out_button') as HTMLButtonElement
      button.click()

      expect(inspector.mockSettingsManager.setGlobalSettings).not.toHaveBeenCalled()
    })

    it('should clear dropdown options', () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)

      const select = document.getElementById('select_value') as HTMLSelectElement
      const option = document.createElement('option')
      option.value = 'device-1'
      select.appendChild(option)

      const button = document.getElementById('sign_out_button') as HTMLButtonElement
      button.click()

      expect(select.length).toBe(1) // Only default option remains
    })
  })

  describe('onSelectChanged', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should update selected option and save settings', async () => {
      const select = document.getElementById('select_value') as HTMLSelectElement
      const option = document.createElement('option')
      option.value = 'device-123'
      select.appendChild(option)
      select.value = 'device-123'

      const event = new Event('change')
      select.dispatchEvent(event)

      await new Promise(resolve => setTimeout(resolve, 0))

      expect(inspector['selectedOptionId']).toBe('device-123')
      expect(inspector.mockSetSettings).toHaveBeenCalled()
    })
  })

  describe('showAuthenticatedUI', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should show auth banner and hide OAuth form', () => {
      inspector['showAuthenticatedUI']()

      const authBanner = document.getElementById('auth_status_banner')
      const oauthSection = document.getElementById('oauth_section')

      expect(authBanner?.style.display).toBe('block')
      expect(oauthSection?.style.display).toBe('none')
    })
  })

  describe('showUnauthenticatedUI', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should hide auth banner and show OAuth form', () => {
      inspector['showUnauthenticatedUI']()

      const authBanner = document.getElementById('auth_status_banner')
      const oauthSection = document.getElementById('oauth_section')

      expect(authBanner?.style.display).toBe('none')
      expect(oauthSection?.style.display).toBe('block')
    })
  })

  describe('populateDropdown', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should populate select with options', () => {
      inspector['selectOptions'] = [
        { id: 'device-1', name: 'Living Room' },
        { id: 'device-2', name: 'Bedroom' },
      ]

      inspector['populateDropdown']()

      const select = document.getElementById('select_value') as HTMLSelectElement
      expect(select.options.length).toBe(3) // 1 default + 2 devices
      expect(select.options[1].value).toBe('device-1')
      expect(select.options[1].text).toBe('Living Room')
      expect(select.options[2].value).toBe('device-2')
      expect(select.options[2].text).toBe('Bedroom')
    })
  })

  describe('selectOptionInDropdown', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
      inspector['selectOptions'] = [
        { id: 'device-1', name: 'Living Room' },
        { id: 'device-2', name: 'Bedroom' },
      ]
      inspector['populateDropdown']()
    })

    it('should select the specified option', () => {
      inspector['selectOptionInDropdown']('device-2')

      const select = document.getElementById('select_value') as HTMLSelectElement
      expect(select.selectedIndex).toBe(2) // 0=default, 1=device-1, 2=device-2
    })

    it('should select default when ID not found', () => {
      inspector['selectOptionInDropdown']('non-existent')

      const select = document.getElementById('select_value') as HTMLSelectElement
      expect(select.selectedIndex).toBe(0)
    })
  })

  describe('propertyInspectorDidAppear', () => {
    beforeEach(() => {
      inspector.onDocumentLoaded()
    })

    it('should show authenticated UI when settings exist', async () => {
      inspector.mockSettingsManager.getGlobalSettings.mockReturnValue(validGlobalSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(false)

      const showAuthenticatedUI = jest.spyOn(inspector as any, 'showAuthenticatedUI')

      await inspector.propertyInspectorDidAppear()

      expect(showAuthenticatedUI).toHaveBeenCalled()
    })

    it('should show unauthenticated UI when no settings', async () => {
      inspector.mockSettingsManager.getGlobalSettings.mockReturnValue({})

      const showUnauthenticatedUI = jest.spyOn(inspector as any, 'showUnauthenticatedUI')

      await inspector.propertyInspectorDidAppear()

      expect(showUnauthenticatedUI).toHaveBeenCalled()
    })

    it('should pre-fill credentials from settings', async () => {
      inspector.mockSettingsManager.getGlobalSettings.mockReturnValue(validGlobalSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(false)

      await inspector.propertyInspectorDidAppear()

      const clientIdInput = document.getElementById('oauth_client_id') as HTMLInputElement
      const clientSecretInput = document.getElementById('oauth_client_secret') as HTMLInputElement

      expect(clientIdInput.value).toBe('test-client-id')
      expect(clientSecretInput.value).toBe('test-client-secret')
    })

    it('should populate dropdown with fetched devices', async () => {
      inspector.mockSettingsManager.getGlobalSettings.mockReturnValue(validGlobalSettings)
      mockOAuthClient.isTokenExpired.mockReturnValue(false)

      await inspector.propertyInspectorDidAppear()

      const select = document.getElementById('select_value') as HTMLSelectElement
      expect(select.options.length).toBeGreaterThan(1) // Has devices
    })
  })
})
