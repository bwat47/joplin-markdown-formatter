import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: [
            { find: /^api\/(.+)$/, replacement: resolve(__dirname, 'api/$1') },
            { find: 'api', replacement: resolve(__dirname, 'api/index.ts') },
        ],
    },
    test: {
        environment: 'node',
        globals: true,
    },
});
