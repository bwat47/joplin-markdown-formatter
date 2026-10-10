import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: [
            { find: /^api\/(.+)$/, replacement: resolve(import.meta.dirname, 'api/$1') },
            { find: 'api', replacement: resolve(import.meta.dirname, 'api/index.ts') },
        ],
    },
    test: {
        environment: 'node',
        globals: true,
    },
});
