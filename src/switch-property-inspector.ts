import { DidReceiveSettingsEvent, SDOnPiEvent } from 'streamdeck-typescript'
import { SelectElement, fetchApi } from './utils/index'
import { SwitchSettingsInterface } from './utils/interface'
import { DeviceList } from '@smartthings/core-sdk'
import { BasePropertyInspector } from './base-property-inspector'

export class SwitchPropertyInspector extends BasePropertyInspector<SwitchSettingsInterface> {
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

  protected saveSettings(): void {
    this.setSettings<SwitchSettingsInterface>({
      deviceId: this.selectedOptionId,
    })
  }

  @SDOnPiEvent('didReceiveSettings')
  onReceiveSettings({ payload }: DidReceiveSettingsEvent<SwitchSettingsInterface>): void {
    this.populateDropdown()

    const deviceId = payload.settings.deviceId
    if (deviceId) {
      this.selectedOptionId = deviceId
      this.selectOptionInDropdown(deviceId)
    }
  }
}

new SwitchPropertyInspector()
