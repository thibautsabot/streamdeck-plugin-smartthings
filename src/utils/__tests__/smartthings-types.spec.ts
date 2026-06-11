import { DeviceCapabilities, SwitchValue, DoorValue } from '../smartthings-types'
import { DeviceStatus } from '@smartthings/core-sdk'

describe('DeviceCapabilities', () => {
  describe('getSwitchValue', () => {
    it('should return ON when switch is on', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            switch: {
              switch: {
                value: 'on',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getSwitchValue(deviceStatus)).toBe(SwitchValue.ON)
    })

    it('should return OFF when switch is off', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            switch: {
              switch: {
                value: 'off',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getSwitchValue(deviceStatus)).toBe(SwitchValue.OFF)
    })

    it('should return null when switch capability missing', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {},
        },
      }

      expect(DeviceCapabilities.getSwitchValue(deviceStatus)).toBeNull()
    })

    it('should return null when switch value is invalid', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            switch: {
              switch: {
                value: 'invalid-value',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getSwitchValue(deviceStatus)).toBeNull()
    })
  })

  describe('getDoorValue', () => {
    it('should return OPEN when door is open', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            doorControl: {
              door: {
                value: 'open',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getDoorValue(deviceStatus)).toBe(DoorValue.OPEN)
    })

    it('should return CLOSED when door is closed', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            doorControl: {
              door: {
                value: 'closed',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getDoorValue(deviceStatus)).toBe(DoorValue.CLOSED)
    })

    it('should return null when doorControl capability missing', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {},
        },
      }

      expect(DeviceCapabilities.getDoorValue(deviceStatus)).toBeNull()
    })

    it('should return null when door value is invalid', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            doorControl: {
              door: {
                value: 'invalid-value',
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getDoorValue(deviceStatus)).toBeNull()
    })
  })

  describe('getSwitchLevel', () => {
    it('should return level when it is a number', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {
            switchLevel: {
              level: {
                value: 50,
              },
            },
          },
        },
      }

      expect(DeviceCapabilities.getSwitchLevel(deviceStatus)).toBe(50)
    })

    it('should return null when switchLevel capability missing', () => {
      const deviceStatus: DeviceStatus = {
        components: {
          main: {},
        },
      }

      expect(DeviceCapabilities.getSwitchLevel(deviceStatus)).toBeNull()
    })

    it('should return null when level value is not a number', () => {
      const deviceStatus = {
        components: {
          main: {
            switchLevel: {
              level: {
                value: 'not-a-number',
              },
            },
          },
        },
      } as unknown as DeviceStatus

      expect(DeviceCapabilities.getSwitchLevel(deviceStatus)).toBeNull()
    })
  })
})
