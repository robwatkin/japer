/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    "ts-jest": {
      compiler: "typescript",
    },
  },
  testRegex: `.*/test/.*.test.ts`,
  "collectCoverage": false,
  "coverageReporters": ["lcov", "text"], // ["lcov"] for full report
  collectCoverageFrom: [
    "**/src/**/*.ts",
    "!**/src/extern/**",
    "!**/src/index.ts",
    "!**/src/startup.ts",
    "!**/src/utils/logger.ts"
  ]
  // globalSetup: "./tests/setup.ts",
  // globalTeardown: "./tests/teardown.ts",
}
