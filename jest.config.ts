import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  coveragePathIgnorePatterns: ['./src/utils/fakeApi.ts', './src/smartthings-plugin.ts'],
}
export default config
