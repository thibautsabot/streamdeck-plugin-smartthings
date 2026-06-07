import {
  SDOnPiEvent,
  StreamDeckPropertyInspectorHandler,
  DidReceiveSettingsEvent,
} from 'streamdeck-typescript'
import {
  isGlobalSettingsSet,
  fetchApi,
  addSelectOption,
  SelectElement,
  isDeviceSetting,
  isSceneSetting,
} from './utils/index'
import {
  GlobalSettingsInterface,
  SceneSettingsInterface,
  DeviceSettingsInterface,
  LightSettingsInterface,
} from './utils/interface'
import { LightBehavior } from './utils/smartthings-types'
import { PagedResult, SceneSummary, DeviceList } from '@smartthings/core-sdk'

const pluginName = 'com.thibautsabot.streamdeck'

class SmartthingsPI extends StreamDeckPropertyInspectorHandler {
  private selectOptions?: SelectElement[]
  private selectedBehaviour: LightBehavior = LightBehavior.TOGGLE
  private selectedOptionId = ''

  constructor() {
    super()
  }

  private isLightAction(): boolean {
    return this.actionInfo.action === pluginName + '.light'
  }

  private isSceneAction(): boolean {
    return this.actionInfo.action === pluginName + '.scene'
  }

  private isDeviceAction(): boolean {
    return (
      this.actionInfo.action === pluginName + '.light' ||
      this.actionInfo.action === pluginName + '.switch' ||
      this.actionInfo.action === pluginName + '.garagedoor'
    )
  }

  @SDOnPiEvent('documentLoaded')
  onDocumentLoaded(): void {
    const validateButton = document.getElementById('validate_button') as HTMLButtonElement
    const selectLabel = document.getElementById('select_label') as HTMLSelectElement
    const select = document.getElementById('select_value') as HTMLSelectElement
    const behaviour = document.getElementById('behaviour') as HTMLDivElement

    validateButton?.addEventListener('click', this.onValidateButtonPressed.bind(this))
    select?.addEventListener('change', this.onSelectChanged.bind(this))
    behaviour?.addEventListener('change', this.onRadioChanged.bind(this))

    if (this.isSceneAction()) {
      validateButton.textContent = 'Fetch scenes list'
      selectLabel.textContent = 'Scenes'
      addSelectOption({ select: select, element: { id: 'none', name: 'No scene' } })
    } else if (this.isDeviceAction()) {
      selectLabel.textContent = 'Devices'
      validateButton.textContent = 'Fetch devices list'
      addSelectOption({ select: select, element: { id: 'none', name: 'No device' } })

      // Only show behaviour selector for Light action
      if (this.isLightAction()) {
        behaviour.className = 'sdpi-item' // Remove hidden class and display radio selection
      }
    }
  }

  private async onValidateButtonPressed() {
    const accessToken = (<HTMLInputElement>document.getElementById('accesstoken'))?.value
    this.settingsManager.setGlobalSettings<GlobalSettingsInterface>({ accessToken })

    let elements: SelectElement[] = []

    if (this.isSceneAction()) {
      const res = await fetchApi<PagedResult<SceneSummary>>({
        endpoint: '/scenes',
        method: 'GET',
        accessToken,
      })
      elements = res.items.map((item) => ({
        id: item.sceneId,
        name: item.sceneName,
      }))
    } else if (this.isDeviceAction()) {
      const res = await fetchApi<DeviceList>({
        endpoint: '/devices',
        method: 'GET',
        accessToken,
      })
      elements = res.items.map((item) => ({
        id: item.deviceId,
        name: item.label,
      }))
    }

    // Store selectOptions locally for later use
    this.selectOptions = elements

    // Request settings to trigger didReceiveSettings which will populate the dropdown
    this.requestSettings()
  }

  public onSelectChanged(e: Event) {
    const newSelection = (e.target as HTMLSelectElement).value
    this.selectedOptionId = newSelection

    if (this.isSceneAction()) {
      this.setSettings<SceneSettingsInterface>({
        sceneId: newSelection,
      })
    } else if (this.isLightAction()) {
      this.setSettings<LightSettingsInterface>({
        deviceId: newSelection,
        behaviour: this.selectedBehaviour,
      })
    } else if (this.isDeviceAction()) {
      this.setSettings<DeviceSettingsInterface>({
        deviceId: newSelection,
      })
    }
  }

  public onRadioChanged(e: Event) {
    const newSelection = (e.target as HTMLInputElement).value as LightBehavior

    if (this.isLightAction()) {
      this.selectedBehaviour = newSelection
      this.setSettings<LightSettingsInterface>({
        deviceId: this.selectedOptionId,
        behaviour: newSelection,
      })
    }
  }

  // Prefill PI elements from cache
  @SDOnPiEvent('globalSettingsAvailable')
  propertyInspectorDidAppear(): void {
    this.requestSettings()
    const globalSettings = this.settingsManager.getGlobalSettings<GlobalSettingsInterface>()

    if (isGlobalSettingsSet(globalSettings)) {
      const accessToken = globalSettings.accessToken
      if (accessToken) {
        ;(<HTMLInputElement>document.getElementById('accesstoken')).value = accessToken
      }
    }
  }

  // Get the devices list from cache
  @SDOnPiEvent('didReceiveSettings')
  onReceiveSettings({
    payload,
  }: DidReceiveSettingsEvent<
    DeviceSettingsInterface | SceneSettingsInterface | LightSettingsInterface
  >): void {
    const select = document.getElementById('select_value') as HTMLSelectElement

    // Populate dropdown if we have options
    if (this.selectOptions) {
      select.length = 1 // Only keep the "No element" option
      this.selectOptions.forEach((element) => addSelectOption({ select, element }))
    }

    let activeIndex: number | undefined

    if (isSceneSetting(payload.settings)) {
      const sceneId = payload.settings.sceneId
      this.selectedOptionId = sceneId
      activeIndex = this.selectOptions?.findIndex((element) => element.id === sceneId)
    } else if (isDeviceSetting(payload.settings)) {
      const deviceId = payload.settings.deviceId
      this.selectedOptionId = deviceId
      activeIndex = this.selectOptions?.findIndex((element) => element.id === deviceId)

      // Handle behaviour for light actions
      if (this.isLightAction() && 'behaviour' in payload.settings) {
        const lightSettings = payload.settings as LightSettingsInterface
        this.selectedBehaviour = lightSettings.behaviour ?? LightBehavior.TOGGLE
        const behaviourElement = document.getElementById(
          this.selectedBehaviour
        ) as HTMLInputElement
        if (behaviourElement) {
          behaviourElement.checked = true
        }
      }
    }

    select.selectedIndex = activeIndex !== undefined && activeIndex >= 0 ? activeIndex + 1 : 0 // + 1 because of the "No element" first option
  }
}

new SmartthingsPI()
