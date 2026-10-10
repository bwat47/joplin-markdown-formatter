// Flat config (ESM). Adds ignores, Node globals, and TS-friendly rule tweaks.

import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import sonarjs from 'eslint-plugin-sonarjs';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import vitest from '@vitest/eslint-plugin';

export default defineConfig([
    globalIgnores(['api/**', 'dist/**']),

    js.configs.recommended,
    sonarjs.configs.recommended,

    // Project TS/JS sources
    {
        files: ['**/*.{ts,tsx,js}'],
        extends: [tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.node,
            },
        },
        plugins: {
            'import-x': importPlugin,
        },
        settings: {
            // Resolve .ts extensions and tsconfig paths, then parse resolved TypeScript imports.
            'import-x/resolver-next': [createTypeScriptImportResolver({ project: './tsconfig.json' })],
            'import-x/extensions': ['.ts', '.tsx', '.js'],
            'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
        },
        rules: {
            // report an error if any circular dependency is found
            'import-x/no-cycle': ['error', { maxDepth: Infinity }],
            'no-useless-escape': 'off',
            '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
            // Use `import type { A }` rather than `import { type A }` when every specifier is a type
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/no-inferrable-types': 'error',
            '@typescript-eslint/explicit-module-boundary-types': 'error',
            // Redundant with TypeScript's own no-overlap check (TS2367) and has false positives
            'sonarjs/different-types-comparison': 'off',
        },
    },

    // JavaScript config files do not need typed linting.
    {
        files: ['**/*.js'],
        extends: [tseslint.configs.disableTypeChecked],
    },

    // Vitest tests use an assertion-aware version of the unbound-method rule.
    {
        files: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        extends: [vitest.configs.recommended],
        languageOptions: {
            globals: vitest.environments.env.globals,
        },
        rules: {
            // mocks use async to satisfy promise-returning interfaces
            '@typescript-eslint/require-await': 'off',
            '@typescript-eslint/unbound-method': 'off',
            'vitest/unbound-method': 'error',
        },
    },

    // Prettier compatibility
    prettier,
]);
