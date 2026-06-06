import { GlobalSettingsInterface } from '../utils/interface'
import { StreamDeckAction } from 'streamdeck-typescript'
import { isGlobalSettingsSet, ApiError } from '../utils/index'
import { Smartthings } from '../smartthings-plugin'

/**
 * Base class for all actions (Scene and Device) with shared error handling and validation
 */
export abstract class BaseAction<T extends BaseAction<T>> extends StreamDeckAction<
  Smartthings,
  T
> {
  constructor(public plugin: Smartthings, actionName: string) {
    super(plugin, actionName)
  }

  /**
   * Get validated global settings or null if not properly configured
   */
  protected getGlobalSettings(): GlobalSettingsInterface | null {
    const globalSettings = this.plugin.settingsManager.getGlobalSettings<GlobalSettingsInterface>()
    return isGlobalSettingsSet(globalSettings) ? globalSettings : null
  }

  /**
   * Handle API errors with consistent logging and user feedback.
   * Automatically detects offline/unavailable status and updates title accordingly.
   */
  protected async handleError(
    context: string,
    error: unknown,
    resourceId: string,
    resourceType: 'device' | 'scene' = 'device'
  ): Promise<void> {
    const apiError = error as ApiError
    console.error(`[${this.constructor.name}] Error for ${resourceType} ${resourceId}:`, apiError)

    // Show alert to user
    await this.plugin.showAlert(context)

    // Handle specific error types
    if (apiError.status === 424 || apiError.status === 503 || apiError.status === 504) {
      await this.plugin.setTitle('⚠️ OFFLINE', context)
    } else if (apiError.status === 404) {
      console.error(
        `[${this.constructor.name}] ${resourceType} ${resourceId} not found - may have been deleted`
      )
    } else if (apiError.status === 401 || apiError.status === 403) {
      console.error(
        `[${this.constructor.name}] Authentication/permission error - check access token`
      )
    } else if (apiError.status === 429) {
      console.error(`[${this.constructor.name}] Rate limit exceeded - too many requests`)
    }
  }

  /**
   * Clear any error titles (e.g., OFFLINE messages).
   * Call this when resource successfully responds.
   */
  protected async clearErrorTitle(context: string): Promise<void> {
    await this.plugin.setTitle('', context)
  }
}
