import { LightBehavior } from './smartthings-types'
import { OAuthTokens } from './oauth-client'

/* eslint-disable @typescript-eslint/no-empty-object-type */

export interface GlobalSettingsInterface {
  oauthTokens: OAuthTokens
  oauthClientId: string
  oauthClientSecret: string
}

export interface SceneSettingsInterface {
  sceneId: string
}

export interface DeviceSettingsInterface {
  deviceId: string
}

export interface LightSettingsInterface extends DeviceSettingsInterface {
  behaviour?: LightBehavior
}

export interface SwitchSettingsInterface extends DeviceSettingsInterface {}

export interface GarageDoorSettingsInterface extends DeviceSettingsInterface {}
