import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jest-fixed-jsdom',

  coveragePathIgnorePatterns: ['./src/utils/fakeApi.ts', './src/smartthings-plugin.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@bundled-es-modules|@mswjs|rettime|strict-event-emitter|@open-draft|until-async)/)',
  ],
  transform: {
    '^.+\\.(js|mjs|ts|tsx)$': 'ts-jest',
  },
  testMatch: ['**/__tests__/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
}
export default config
