import type { Config } from "jest";

const config: Config = {
  // Gunakan ts-jest untuk TypeScript support
  preset: "ts-jest/presets/default-esm",

  // Backend service environment
  testEnvironment: "node",

  // Pattern file test
  testMatch: ["**/__tests__/**/*.test.ts"],

  // ESM support
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
        diagnostics: false,
      },
    ],
  },

  // Coverage configuration
  collectCoverageFrom: [
    "src/service.ts",
    "src/utils/helper.ts",
    "!src/**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ["text", "lcov", "html"],

  // Verbose output untuk melihat setiap test case
  verbose: true,
};

export default config;
