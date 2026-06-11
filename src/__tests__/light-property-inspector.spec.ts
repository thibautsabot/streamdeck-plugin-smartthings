import 'isomorphic-fetch'
import { LightPropertyInspector } from '../light-property-inspector'
import { LightBehavior } from '../utils/smartthings-types'
import { GlobalSettingsInterface } from '../utils/interface'
import * as utils from '../utils/index'

// Mock fetchApi
jest.mock('../utils/index', () => ({
  ...jest.requireActual('../utils/index'),
  fetchApi: jest.fn(),
}))

// Create a test class with mockable settingsManager
class TestLightPropertyInspector extends LightPropertyInspector {
  public mockSettingsManager = {
    setGlobalSettings: jest.fn(),
    getGlobalSettings: jest.fn(),
  }

  get settingsManager(): any {
    return this.mockSettingsManager
  }
}

describe('LightPropertyInspector', () => {
  let inspector: TestLightPropertyInspector
  let mockFetchApi: jest.MockedFunction<typeof utils.fetchApi>

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
    mockFetchApi = utils.fetchApi as jest.MockedFunction<typeof utils.fetchApi>

    // Setup DOM
    document.body.innerHTML = `
      <div id="mainSettings">
        <select id="select_value"></select>
        <input type="radio" id="toggle" name="behaviour" value="toggle">
        <input type="radio" id="on" name="behaviour" value="on">
        <input type="radio" id="off" name="behaviour" value="off">
        <span id="more-option" style="display: none;">
          <input type="radio" id="more" name="behaviour" value="more">
        </span>
        <span id="less-option" style="display: none;">
          <input type="radio" id="less" name="behaviour" value="less">
        </span>
      </div>
    `

    inspector = new TestLightPropertyInspector()
    // Setup default mock for global settings
    inspector.mockSettingsManager.getGlobalSettings.mockReturnValue(validGlobalSettings)
  })

  describe('fetchOptions', () => {
    it('should fetch and map device list', async () => {
      const mockDevices = {
        items: [
          { deviceId: 'device-1', label: 'Living Room Light' },
          { deviceId: 'device-2', label: 'Bedroom Light' },
        ],
      }

      mockFetchApi.mockResolvedValue(mockDevices)

      const result = await inspector['fetchOptions']('test-token')

      expect(mockFetchApi).toHaveBeenCalledWith({
        endpoint: '/devices',
        method: 'GET',
        accessToken: 'test-token',
      })

      expect(result).toEqual([
        { id: 'device-1', name: 'Living Room Light' },
        { id: 'device-2', name: 'Bedroom Light' },
      ])
    })
  })

  describe('updateBehaviourOptions', () => {

    it('should hide more/less options when no device selected', async () => {
      const moreOption = document.getElementById('more-option') as HTMLSpanElement
      const lessOption = document.getElementById('less-option') as HTMLSpanElement

      moreOption.style.display = ''
      lessOption.style.display = ''

      await inspector['updateBehaviourOptions']('none')

      expect(moreOption.style.display).toBe('none')
      expect(lessOption.style.display).toBe('none')
    })

    it('should show more/less options for devices with switchLevel capability', async () => {
      const mockDeviceStatus = {
        components: {
          main: {
            switchLevel: {
              level: {
                value: 50,
              },
            },
          },
        },
      }

      mockFetchApi.mockResolvedValue(mockDeviceStatus)

      const moreOption = document.getElementById('more-option') as HTMLSpanElement
      const lessOption = document.getElementById('less-option') as HTMLSpanElement

      await inspector['updateBehaviourOptions']('device-1')

      expect(mockFetchApi).toHaveBeenCalledWith({
        endpoint: '/devices/device-1/status',
        method: 'GET',
        accessToken: 'valid-access-token',
      })

      expect(moreOption.style.display).toBe('')
      expect(lessOption.style.display).toBe('')
    })

    it('should hide more/less options for devices without switchLevel capability', async () => {
      const mockDeviceStatus = {
        components: {
          main: {
            switch: {
              switch: {
                value: 'on',
              },
            },
          },
        },
      }

      mockFetchApi.mockResolvedValue(mockDeviceStatus)

      const moreOption = document.getElementById('more-option') as HTMLSpanElement
      const lessOption = document.getElementById('less-option') as HTMLSpanElement

      await inspector['updateBehaviourOptions']('device-1')

      expect(moreOption.style.display).toBe('none')
      expect(lessOption.style.display).toBe('none')
    })

    it('should reset to TOGGLE if MORE/LESS selected but device has no switchLevel', async () => {
      const mockDeviceStatus = {
        components: {
          main: {
            switch: { switch: { value: 'on' } },
          },
        },
      }

      mockFetchApi.mockResolvedValue(mockDeviceStatus)

      inspector['selectedBehaviour'] = LightBehavior.MORE
      const toggleRadio = document.getElementById('toggle') as HTMLInputElement

      await inspector['updateBehaviourOptions']('device-1')

      expect(inspector['selectedBehaviour']).toBe(LightBehavior.TOGGLE)
      expect(toggleRadio.checked).toBe(true)
    })

    it('should handle fetch errors gracefully and show all options', async () => {
      mockFetchApi.mockRejectedValue(new Error('Network error'))

      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation()
      const moreOption = document.getElementById('more-option') as HTMLSpanElement
      const lessOption = document.getElementById('less-option') as HTMLSpanElement

      await inspector['updateBehaviourOptions']('device-1')

      expect(consoleWarn).toHaveBeenCalledWith(
        '[LightPropertyInspector] Could not fetch device capabilities:',
        expect.any(Error)
      )

      // On error, show all options to be safe
      expect(moreOption.style.display).toBe('')
      expect(lessOption.style.display).toBe('')

      consoleWarn.mockRestore()
    })

    it('should not fetch when no global settings', async () => {
      inspector.mockSettingsManager.getGlobalSettings.mockReturnValue({})

      await inspector['updateBehaviourOptions']('device-1')

      expect(mockFetchApi).not.toHaveBeenCalled()
    })
  })

  describe('saveSettings', () => {
    it('should save device ID and behaviour', () => {
      const mockSetSettings = jest.fn()
      inspector['setSettings'] = mockSetSettings
      inspector['selectedOptionId'] = 'device-123'
      inspector['selectedBehaviour'] = LightBehavior.MORE

      inspector['saveSettings']()

      expect(mockSetSettings).toHaveBeenCalledWith({
        deviceId: 'device-123',
        behaviour: LightBehavior.MORE,
      })
    })
  })

  describe('onReceiveSettings', () => {
    it('should restore device selection and behaviour from settings', () => {
      const mockPopulateDropdown = jest.fn()
      const mockSelectOptionInDropdown = jest.fn()
      const mockUpdateBehaviourOptions = jest.fn()

      inspector['populateDropdown'] = mockPopulateDropdown
      inspector['selectOptionInDropdown'] = mockSelectOptionInDropdown
      inspector['updateBehaviourOptions'] = mockUpdateBehaviourOptions

      const lessRadio = document.getElementById('less') as HTMLInputElement

      const event = {
        payload: {
          settings: {
            deviceId: 'device-456',
            behaviour: LightBehavior.LESS,
          },
        },
      } as any

      inspector.onReceiveSettings(event)

      expect(mockPopulateDropdown).toHaveBeenCalled()
      expect(inspector['selectedOptionId']).toBe('device-456')
      expect(mockSelectOptionInDropdown).toHaveBeenCalledWith('device-456')
      expect(mockUpdateBehaviourOptions).toHaveBeenCalledWith('device-456')
      expect(inspector['selectedBehaviour']).toBe(LightBehavior.LESS)
      expect(lessRadio.checked).toBe(true)
    })

    it('should handle settings without behaviour', () => {
      const mockPopulateDropdown = jest.fn()
      inspector['populateDropdown'] = mockPopulateDropdown

      const event = {
        payload: {
          settings: {
            deviceId: 'device-789',
          },
        },
      } as any

      inspector.onReceiveSettings(event)

      expect(mockPopulateDropdown).toHaveBeenCalled()
      expect(inspector['selectedOptionId']).toBe('device-789')
    })
  })
})
