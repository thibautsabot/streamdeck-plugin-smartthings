import 'isomorphic-fetch'

import { FakeStreamdeckApi } from '../../utils/fakeApi'
import { BaseAction } from '../base-action'
import { Smartthings } from '../../smartthings-plugin'
import { ApiError } from '../../utils/index'
import { GlobalSettingsInterface } from '../../utils/interface'

// Create a concrete test class since BaseAction is abstract
class TestAction extends BaseAction<TestAction> {
  constructor(plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }
}

describe('BaseAction', () => {
  let testAction: TestAction
  let fakePlugin: Smartthings

  beforeEach(() => {
    jest.clearAllMocks()
    // Suppress console.error globally for cleaner test output
    jest.spyOn(console, 'error').mockImplementation()
    fakePlugin = new FakeStreamdeckApi() as Smartthings
    testAction = new TestAction(fakePlugin, 'com.test.action')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getGlobalSettings', () => {
    it('should return settings when OAuth credentials are defined', () => {
      const mockSettings = {
        oauthTokens: {
          accessToken: 'valid-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: Date.now() + 3600000,
          tokenType: 'Bearer',
        },
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      }
      fakePlugin.settingsManager.getGlobalSettings = () => mockSettings

      const settings = testAction['getGlobalSettings']()

      expect(settings).toEqual(mockSettings)
    })

    it('should return null when OAuth credentials are incomplete', () => {
      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue({
        oauthTokens: undefined,
        oauthClientId: 'client-id',
        oauthClientSecret: 'client-secret',
      } as Partial<GlobalSettingsInterface>)

      const settings = testAction['getGlobalSettings']()

      expect(settings).toBeNull()
    })

    it('should return null when settings is an empty object', () => {
      fakePlugin.settingsManager.getGlobalSettings = jest.fn().mockReturnValue({} as GlobalSettingsInterface)

      const settings = testAction['getGlobalSettings']()

      expect(settings).toBeNull()
    })
  })

  describe('handleError', () => {
    const context = 'test-context'
    const resourceId = 'device-123'

    it('should show alert and set OFFLINE title for service errors (424/503/504)', async () => {
      const error: ApiError = new Error('Service Unavailable') as ApiError
      error.status = 503
      error.statusText = 'Service Unavailable'

      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()
      const setTitle = jest.spyOn(fakePlugin, 'setTitle').mockImplementation()

      await testAction['handleError'](context, error, resourceId, 'device')

      expect(showAlert).toHaveBeenCalledWith(context)
      expect(setTitle).toHaveBeenCalledWith('⚠️ OFFLINE', context)

      showAlert.mockRestore()
      setTitle.mockRestore()
    })

    it('should log 404 errors without setting OFFLINE', async () => {
      const error: ApiError = new Error('Not Found') as ApiError
      error.status = 404
      error.statusText = 'Not Found'

      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()
      const setTitle = jest.spyOn(fakePlugin, 'setTitle').mockImplementation()

      await testAction['handleError'](context, error, resourceId, 'device')

      expect(showAlert).toHaveBeenCalledWith(context)
      expect(setTitle).not.toHaveBeenCalled()

      showAlert.mockRestore()
      setTitle.mockRestore()
    })

    it('should log authentication errors (401)', async () => {
      const error: ApiError = new Error('Unauthorized') as ApiError
      error.status = 401
      error.statusText = 'Unauthorized'

      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()

      await testAction['handleError'](context, error, resourceId, 'scene')

      expect(showAlert).toHaveBeenCalledWith(context)

      showAlert.mockRestore()
    })

    it('should log rate limit errors (429)', async () => {
      const error: ApiError = new Error('Too Many Requests') as ApiError
      error.status = 429
      error.statusText = 'Too Many Requests'

      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()

      await testAction['handleError'](context, error, resourceId, 'device')

      expect(showAlert).toHaveBeenCalledWith(context)

      showAlert.mockRestore()
    })

    it('should default to device resourceType when not provided', async () => {
      const error: ApiError = new Error('Generic Error') as ApiError
      error.status = 500
      error.statusText = 'Internal Server Error'

      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()

      // Call without resourceType parameter to test default
      await testAction['handleError'](context, error, resourceId)

      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('device'),
        expect.anything()
      )
      expect(showAlert).toHaveBeenCalledWith(context)

      consoleError.mockRestore()
      showAlert.mockRestore()
    })
  })

  describe('clearErrorTitle', () => {
    it('should clear the title', async () => {
      const context = 'test-context'
      const setTitle = jest.spyOn(fakePlugin, 'setTitle').mockImplementation()

      await testAction['clearErrorTitle'](context)

      expect(setTitle).toHaveBeenCalledWith('', context)

      setTitle.mockRestore()
    })
  })
})
