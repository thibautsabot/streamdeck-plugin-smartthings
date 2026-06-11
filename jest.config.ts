import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jest-fixed-jsdom',

  coveragePathIgnorePatterns: [
    '/node_modules/',
    'src/utils/fakeApi.ts',
    'src/utils/oauth-fixtures.ts',
    'src/smartthings-plugin.ts',
    'src/scene-property-inspector.ts',
    'src/switch-property-inspector.ts',
    'src/garagedoor-property-inspector.ts',
    'src/utils/interface.ts',
  ],
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
