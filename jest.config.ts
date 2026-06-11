import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'jest-fixed-jsdom',
  coverageProvider: 'babel',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/**/*-property-inspector.ts',
    '!src/*-property-inspector.ts',
    '!src/utils/fakeApi.ts',
    '!src/test-helpers/**',
    '!src/smartthings-plugin.ts',
    '!src/utils/interface.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@bundled-es-modules|@mswjs|rettime|strict-event-emitter|@open-draft|until-async)/)',
  ],
  transform: {
    '^.+\\.(js|mjs|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testMatch: ['**/__tests__/**/*.spec.ts'],
}
export default config
