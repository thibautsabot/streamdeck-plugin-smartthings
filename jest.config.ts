import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  coveragePathIgnorePatterns: ['./src/utils/fakeApi.ts', './src/smartthings-plugin.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@bundled-es-modules|@mswjs|rettime|strict-event-emitter|@open-draft)/)',
  ],
  testMatch: ['**/__tests__/**/*.spec.ts'],
}
export default config
