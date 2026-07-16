import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: './tsconfig.test.json',
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { statements: 48, branches: 25, functions: 35, lines: 50 },
    './src/modules/payments/payments.service.ts': {
      statements: 38,
      branches: 24,
      functions: 60,
      lines: 40,
    },
    './src/modules/queue/queue.service.ts': {
      statements: 50,
      branches: 42,
      functions: 45,
      lines: 52,
    },
    './src/modules/notifications/notification-outbox.repository.ts': {
      statements: 60,
      branches: 45,
      functions: 40,
      lines: 60,
    },
  },
};

export default config;
