/**
 * Fixture-based tests for the full formatting pipeline.
 *
 * Each directory under fixtures/ is one case:
 *   input.md      document to format
 *   expected.md   exact expected output (byte-for-byte)
 *   options.json  optional partial FormatterOptions overrides
 *
 * Every case is also checked for idempotency: formatting the output again
 * must be a no-op, or the formatter would churn notes on every run.
 */

import * as fs from 'fs';
import * as path from 'path';
import { formatMarkdown } from './pipeline';
import type { FormatterOptions } from './types';

const fixturesDir = path.join(process.cwd(), 'src', 'formatter', 'fixtures');

const caseNames = fs
    .readdirSync(fixturesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

describe('formatMarkdown fixtures', () => {
    test.each(caseNames)('%s', (name) => {
        const caseDir = path.join(fixturesDir, name);
        const input = fs.readFileSync(path.join(caseDir, 'input.md'), 'utf8');
        const expected = fs.readFileSync(path.join(caseDir, 'expected.md'), 'utf8');
        const optionsPath = path.join(caseDir, 'options.json');
        const options: Partial<FormatterOptions> = fs.existsSync(optionsPath)
            ? JSON.parse(fs.readFileSync(optionsPath, 'utf8'))
            : {};

        const result = formatMarkdown(input, options);
        expect(result.text).toBe(expected);
        expect(result.skippedRules).toEqual([]);
        expect(formatMarkdown(result.text, options).text).toBe(result.text);
    });
});
