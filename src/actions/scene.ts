import { SceneSettingsInterface } from '../utils/interface'
import { KeyUpEvent, SDOnActionEvent } from 'streamdeck-typescript'
import { fetchApi } from '../utils/index'

import { Smartthings } from '../smartthings-plugin'
import { Status } from '@smartthings/core-sdk'
import { BaseAction } from './base-action'

export class SceneAction extends BaseAction<SceneAction> {
  constructor(
    public plugin: Smartthings,
    private actionName: string,
  ) {
    super(plugin, actionName)
  }

  @SDOnActionEvent('keyUp')
  public async onKeyUp({
    context,
    payload,
    action,
  }: KeyUpEvent<SceneSettingsInterface>): Promise<void> {
    if (action !== 'com.thibautsabot.streamdeck.scene') return

    const accessToken = await this.getAccessToken()

    // Validate access token
    if (!accessToken) {
      console.warn('[Scene] No access token configured')
      await this.plugin.showAlert(context)
      return
    }

    // Validate scene ID
    if (!payload.settings.sceneId) {
      console.warn('[Scene] No sceneId configured')
      await this.plugin.showAlert(context)
      return
    }

    const sceneId = payload.settings.sceneId

    try {
      await fetchApi<Status>({
        endpoint: `/scenes/${sceneId}/execute`,
        accessToken,
        method: 'POST',
      })

      // Show success feedback
      await this.plugin.showOk(context)
    } catch (error) {
      await this.handleError(context, error, sceneId, 'scene')
    }
  }
}
