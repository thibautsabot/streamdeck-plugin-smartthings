module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    [
      'babel-plugin-istanbul',
      {
        exclude: [
          '**/__tests__/**',
          '**/node_modules/**',
          '**/*-property-inspector.ts',
          '**/fakeApi.ts',
          '**/test-helpers/**',
          '**/smartthings-plugin.ts',
          '**/interface.ts',
        ],
      },
    ],
  ],
}
