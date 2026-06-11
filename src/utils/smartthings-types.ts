import { DeviceStatus } from '@smartthings/core-sdk'

/**
 * SmartThings capability value enums for type safety
 */
export enum SwitchValue {
  ON = 'on',
  OFF = 'off',
}

export enum DoorValue {
  OPEN = 'open',
  CLOSED = 'closed',
  OPENING = 'opening',
  CLOSING = 'closing',
}

export enum LightBehavior {
  TOGGLE = 'toggle',
  MORE = 'more',
  LESS = 'less',
}

/**
 * Type-safe helpers for navigating device status components
 */
export class DeviceCapabilities {
  /**
   * Safely get switch capability value from device status
   */
  static getSwitchValue(deviceStatus: DeviceStatus): SwitchValue | null {
    const value = deviceStatus.components?.main?.switch?.switch?.value
    if (value === SwitchValue.ON || value === SwitchValue.OFF) {
      return value
    }
    return null
  }

  /**
   * Safely get door control capability value from device status
   */
  static getDoorValue(deviceStatus: DeviceStatus): DoorValue | null {
    const value = deviceStatus.components?.main?.doorControl?.door?.value
    if (Object.values(DoorValue).includes(value as DoorValue)) {
      return value as DoorValue
    }
    return null
  }

  /**
   * Safely get switch level (dimmer) capability value from device status
   */
  static getSwitchLevel(deviceStatus: DeviceStatus): number | null {
    const value = deviceStatus.components?.main?.switchLevel?.level?.value
    return typeof value === 'number' ? value : null
  }
}
