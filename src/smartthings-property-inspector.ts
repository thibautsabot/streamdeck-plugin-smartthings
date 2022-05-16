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
} from './utils/interface'
import { PagedResult, SceneSummary, DeviceList } from '@smartthings/core-sdk'

const pluginName = 'com.thibautsabot.streamdeck'

class SmartthingsPI extends StreamDeckPropertyInspectorHandler {
  private selectOptions?: SelectElement[]
  private selectedBehaviour = 'toggle'
  private selectedOptionId: string

  constructor() {
    super()
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

    switch (this.actionInfo.action) {
      case pluginName + '.device': {
        selectLabel.textContent = 'Devices'
        validateButton.textContent = 'Fetch devices list'
        addSelectOption({ select: select, element: { id: 'none', name: 'No device' } })
        behaviour.className = 'sdpi-item' // Remove hidden class and display radio selection
        break
      }
      case pluginName + '.scene': {
        validateButton.textContent = 'Fetch scenes list'
        selectLabel.textContent = 'Scenes'
        addSelectOption({ select: select, element: { id: 'none', name: 'No scene' } })
        break
      }
    }
  }

  private async onValidateButtonPressed() {
    const accessToken = (<HTMLInputElement>document.getElementById('accesstoken'))?.value
    this.settingsManager.setGlobalSettings<GlobalSettingsInterface>({ accessToken })

    let elements: SelectElement[] = []

    switch (this.actionInfo.action) {
      case pluginName + '.scene': {
        const res = await fetchApi<PagedResult<SceneSummary>>({
          endpoint: '/scenes',
          method: 'GET',
          accessToken,
        })
        elements = res.items.map((item) => ({
          id: item.sceneId,
          name: item.sceneName,
        }))
        break
      }
      case pluginName + '.device': {
        const res = await fetchApi<DeviceList>({
          endpoint: '/devices',
          method: 'GET',
          accessToken,
        })
        elements = res.items.map((item) => ({
          id: item.deviceId,
          name: item.label,
        }))
        break
      }
    }

    this.setSettings({
      selectOptions: elements,
      behaviour: this.selectedBehaviour,
    })
    this.requestSettings() // requestSettings will add the options to the select element
  }

  public onSelectChanged(e: Event) {
    const newSelection = (e.target as HTMLSelectElement).value
    this.selectedOptionId = newSelection
    switch (this.actionInfo.action) {
      case pluginName + '.scene': {
        this.setSettings<SceneSettingsInterface>({
          selectOptions: this.selectOptions,
          sceneId: newSelection,
        })
        break
      }
      case pluginName + '.device': {
        this.setSettings<DeviceSettingsInterface>({
          selectOptions: this.selectOptions,
          deviceId: newSelection,
          behaviour: this.selectedBehaviour
        })
        break
      }
    }
  }

  public onRadioChanged(e: Event) {
    const newSelection = (e.target as HTMLSelectElement).value

    switch (this.actionInfo.action) {
      case pluginName + '.device': {
        this.setSettings<DeviceSettingsInterface>({
          selectOptions: this.selectOptions,
          deviceId: this.selectedOptionId,
          behaviour: newSelection
        })
        break
      }
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
  }: DidReceiveSettingsEvent<DeviceSettingsInterface | SceneSettingsInterface>): void {
    const select = document.getElementById('select_value') as HTMLSelectElement
    this.selectOptions = payload.settings.selectOptions
    select.length = 1 // Only keep the "No element" option
    this.selectOptions?.forEach((element) => addSelectOption({ select, element }))

    let activeIndex: number | undefined
    if (isDeviceSetting(payload.settings)) {
      const deviceId = payload.settings.deviceId
      this.selectedOptionId = deviceId

      this.selectedBehaviour = payload.settings.behaviour;
      (document.getElementById(this.selectedBehaviour) as HTMLInputElement).checked = true

      activeIndex = this.selectOptions?.findIndex((element) => element.id === deviceId) || 0
    }
    if (isSceneSetting(payload.settings)) {
      const sceneId = payload.settings.sceneId
      activeIndex = this.selectOptions?.findIndex((element) => element.id === sceneId) || 0

      this.selectedOptionId = sceneId
    }
    select.selectedIndex = activeIndex !== undefined ? activeIndex + 1 : 0 // + 1 because of the "No element" first option
  }
}

new SmartthingsPI()
