import { DidReceiveSettingsEvent, SDOnPiEvent } from 'streamdeck-typescript'
import { SelectElement, fetchApi } from './utils/index'
import { SceneSettingsInterface } from './utils/interface'
import { PagedResult, SceneSummary } from '@smartthings/core-sdk'
import { BasePropertyInspector } from './base-property-inspector'

export class ScenePropertyInspector extends BasePropertyInspector<SceneSettingsInterface> {
  protected getDefaultOptionLabel(): string {
    return 'No scene'
  }

  protected async fetchOptions(accessToken: string): Promise<SelectElement[]> {
    const res = await fetchApi<PagedResult<SceneSummary>>({
      endpoint: '/scenes',
      method: 'GET',
      accessToken,
    })

    return res.items.map((item) => ({
      id: item.sceneId,
      name: item.sceneName,
    }))
  }

  protected saveSettings(): void {
    this.setSettings<SceneSettingsInterface>({
      sceneId: this.selectedOptionId,
    })
  }

  @SDOnPiEvent('didReceiveSettings')
  onReceiveSettings({ payload }: DidReceiveSettingsEvent<SceneSettingsInterface>): void {
    this.populateDropdown()

    const sceneId = payload.settings.sceneId
    if (sceneId) {
      this.selectedOptionId = sceneId
      this.selectOptionInDropdown(sceneId)
    }
  }
}

new ScenePropertyInspector()
