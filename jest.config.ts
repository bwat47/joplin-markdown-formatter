import type { Config } from 'jest';

/**
 * Jest runs in ESM mode (requires NODE_OPTIONS=--experimental-vm-modules,
 * set in the npm test scripts) because the mdast/micromark parsing packages
 * are ESM-only. Tests needing a DOM can opt into jsdom per file with a
 * "@jest-environment jsdom" docblock.
 */
const config: Config = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', { useESM: true }],
    },
    moduleNameMapper: {
        '^api$': '<rootDir>/api/index.ts',
        '^api/(.*)$': '<rootDir>/api/$1',
    },
};

export default config;
