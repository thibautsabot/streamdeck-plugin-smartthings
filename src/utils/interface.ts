import { LightBehavior } from './smartthings-types'

export interface GlobalSettingsInterface {
  accessToken: string
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