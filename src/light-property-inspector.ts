import { DidReceiveSettingsEvent, SDOnPiEvent } from 'streamdeck-typescript'
import { SelectElement, fetchApi, isGlobalSettingsSet } from './utils/index'
import { LightSettingsInterface, GlobalSettingsInterface } from './utils/interface'
import { DeviceList, DeviceStatus } from '@smartthings/core-sdk'
import { LightBehavior } from './utils/smartthings-types'
import { BasePropertyInspector } from './base-property-inspector'

export class LightPropertyInspector extends BasePropertyInspector<LightSettingsInterface> {
  private selectedBehaviour: LightBehavior = LightBehavior.TOGGLE

  protected getDefaultOptionLabel(): string {
    return 'No device'
  }

  protected async fetchOptions(accessToken: string): Promise<SelectElement[]> {
    const res = await fetchApi<DeviceList>({
      endpoint: '/devices',
      method: 'GET',
      accessToken,
    })

    return res.items.map((item) => ({
      id: item.deviceId,
      name: item.label,
    }))
  }

  protected onDocumentLoadedExtended(): void {
    const radioButtons = document.querySelectorAll('input[name="behaviour"]')
    radioButtons.forEach((radio) => {
      radio.addEventListener('change', this.onRadioChanged.bind(this))
    })
  }

  protected async onSelectChanged(e: Event): Promise<void> {
    const newSelection = (e.target as HTMLSelectElement).value
    this.selectedOptionId = newSelection
    await this.updateBehaviourOptions(newSelection)
    this.saveSettings()
  }

  private onRadioChanged(e: Event) {
    const newSelection = (e.target as HTMLInputElement).value as LightBehavior
    this.selectedBehaviour = newSelection
    this.saveSettings()
  }

  protected saveSettings(): void {
    this.setSettings<LightSettingsInterface>({
      deviceId: this.selectedOptionId,
      behaviour: this.selectedBehaviour,
    })
  }

  private async updateBehaviourOptions(deviceId: string): Promise<void> {
    const moreOption = document.getElementById('more-option') as HTMLSpanElement
    const lessOption = document.getElementById('less-option') as HTMLSpanElement
    const toggleRadio = document.getElementById('toggle') as HTMLInputElement

    if (!deviceId || deviceId === 'none') {
      if (moreOption) moreOption.style.display = 'none'
      if (lessOption) lessOption.style.display = 'none'
      return
    }

    const globalSettings = this.settingsManager.getGlobalSettings<GlobalSettingsInterface>()
    if (!isGlobalSettingsSet(globalSettings)) return

    const accessToken = globalSettings.oauthTokens.accessToken

    try {
      const deviceStatus = await fetchApi<DeviceStatus>({
        endpoint: `/devices/${deviceId}/status`,
        method: 'GET',
        accessToken,
      })

      const hasSwitchLevel = deviceStatus.components?.main?.switchLevel?.level?.value !== undefined

      if (hasSwitchLevel) {
        if (moreOption) moreOption.style.display = 'inline'
        if (lessOption) lessOption.style.display = 'inline'
      } else {
        if (moreOption) moreOption.style.display = 'none'
        if (lessOption) lessOption.style.display = 'none'

        if (
          this.selectedBehaviour === LightBehavior.MORE ||
          this.selectedBehaviour === LightBehavior.LESS
        ) {
          this.selectedBehaviour = LightBehavior.TOGGLE
          if (toggleRadio) toggleRadio.checked = true
        }
      }
    } catch (error) {
      console.warn('[LightPropertyInspector] Could not fetch device capabilities:', error)
      // On error, show all options as fallback
      if (moreOption) moreOption.style.display = 'inline'
      if (lessOption) lessOption.style.display = 'inline'
    }
  }

  @SDOnPiEvent('didReceiveSettings')
  onReceiveSettings({ payload }: DidReceiveSettingsEvent<LightSettingsInterface>): void {
    this.populateDropdown()

    const settings = payload.settings

    const deviceId = settings.deviceId
    if (deviceId) {
      this.selectedOptionId = deviceId
      this.selectOptionInDropdown(deviceId)
      this.updateBehaviourOptions(deviceId)
    }

    if (settings.behaviour) {
      this.selectedBehaviour = settings.behaviour
      const behaviourElement = document.getElementById(settings.behaviour) as HTMLInputElement
      if (behaviourElement) {
        behaviourElement.checked = true
      }
    }
  }
}

new LightPropertyInspector()
