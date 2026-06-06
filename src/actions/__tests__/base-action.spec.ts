import 'isomorphic-fetch'

import { FakeStreamdeckApi } from '../../utils/fakeApi'
import { BaseAction } from '../base-action'
import { Smartthings } from '../../smartthings-plugin'
import { ApiError } from '../../utils/index'

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
    it('should return settings when accessToken is defined', () => {
      fakePlugin.settingsManager.getGlobalSettings = () => ({ accessToken: 'valid-token' })

      const settings = testAction['getGlobalSettings']()

      expect(settings).toEqual({ accessToken: 'valid-token' })
    })

    it('should return null when accessToken is undefined', () => {
      fakePlugin.settingsManager.getGlobalSettings = () => ({ accessToken: undefined })

      const settings = testAction['getGlobalSettings']()

      expect(settings).toBeNull()
    })

    it('should return null when settings is an empty object', () => {
      fakePlugin.settingsManager.getGlobalSettings = () => ({} as any)

      const settings = testAction['getGlobalSettings']()

      expect(settings).toBeNull()
    })
  })

  describe('handleError', () => {
    const context = 'test-context'
    const resourceId = 'device-123'

    it('should show alert and set OFFLINE title for 424 errors', async () => {
      const error: ApiError = new Error('Failed Dependency') as ApiError
      error.status = 424
      error.statusText = 'Failed Dependency'

      const showAlert = jest.spyOn(fakePlugin, 'showAlert').mockImplementation()
      const setTitle = jest.spyOn(fakePlugin, 'setTitle').mockImplementation()

      await testAction['handleError'](context, error, resourceId, 'device')

      expect(showAlert).toHaveBeenCalledWith(context)
      expect(setTitle).toHaveBeenCalledWith('⚠️ OFFLINE', context)

      showAlert.mockRestore()
      setTitle.mockRestore()
    })

    it('should show alert and set OFFLINE title for 503 errors', async () => {
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

    it('should show alert and set OFFLINE title for 504 errors', async () => {
      const error: ApiError = new Error('Gateway Timeout') as ApiError
      error.status = 504
      error.statusText = 'Gateway Timeout'

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
