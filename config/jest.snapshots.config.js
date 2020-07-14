/*eslint-env node*/
const path = require('path'); // eslint-disable-line

const config = require('../jest.config');

module.exports = {
  ...config,
  preset: '@visual-snapshot/jest',
  setupFilesAfterEnv: ['@visual-snapshot/jest', '<rootDir>/tests/js/setupFramework.js'],
  testEnvironmentOptions: {
    output: path.resolve(__dirname, '.artifacts', 'visual-snapshots', 'jest'),
    includeCss: path.resolve(
      __dirname,
      'src',
      'sentry',
      'static',
      'sentry',
      'dist',
      'sentry.css'
    ),
  },
};
