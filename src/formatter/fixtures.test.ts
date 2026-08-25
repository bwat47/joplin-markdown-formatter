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
import { expectIdempotent } from './testUtils';
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

        const result = expectIdempotent(input, options);
        expect(result.text).toBe(expected);
        expect(result.skippedRules).toEqual([]);
    });
});

interface IdempotencyProfile {
    name: string;
    options: Partial<FormatterOptions>;
}

const idempotencyProfiles: IdempotencyProfile[] = [
    { name: 'defaults', options: {} },
    {
        name: 'preserving modes',
        options: {
            unorderedListMarker: 'preserve',
            doubleQuoteStyle: 'preserve',
            singleQuoteStyle: 'preserve',
            linkTextSpacing: 'preserve',
            listSpacing: 'preserve',
            tableStyle: 'preserve',
            normalizeOrderedListNumbering: false,
            normalizeHeadingLevels: false,
        },
    },
    {
        name: 'compact tight two-space layout',
        options: {
            indentation: 'spaces2',
            listSpacing: 'tight',
            tableStyle: 'compact',
            linkTextSpacing: 'spaces',
            minimumHeadingLevel: 'h2',
            thematicBreakMarker: '---',
        },
    },
    {
        name: 'aligned loose four-space layout',
        options: {
            indentation: 'spaces4',
            listSpacing: 'loose',
            tableStyle: 'aligned',
            minimumHeadingLevel: 'firstHeading',
            thematicBreakMarker: '- - -',
            setDefaultCodeBlockLanguage: true,
            defaultCodeBlockLanguage: 'text',
        },
    },
    {
        name: 'alternate inline and marker styles',
        options: {
            unorderedListMarker: '*',
            thematicBreakMarker: '***',
            emphasisMarker: '_',
            strongMarker: '__',
            doubleQuoteStyle: 'smart',
            singleQuoteStyle: 'straight',
        },
    },
    {
        name: 'spacing disabled',
        options: {
            collapseBlankLines: false,
            trimTrailingWhitespace: false,
            ensureHeadingBlankLines: false,
            ensureParagraphBlankLines: false,
            ensureCodeBlockBlankLines: false,
            ensureMathBlockBlankLines: false,
            ensureTableBlankLines: false,
            ensureBlockquoteBlankLines: false,
            ensureListBlankLines: false,
            ensureFrontmatterBlankLine: false,
            ensureFinalNewline: false,
        },
    },
];

const profileCases = caseNames.flatMap((caseName) => idempotencyProfiles.map((profile) => ({ caseName, profile })));

describe('formatMarkdown fixture option profiles', () => {
    test.each(profileCases)('$caseName — $profile.name', ({ caseName, profile }) => {
        const input = fs.readFileSync(path.join(fixturesDir, caseName, 'input.md'), 'utf8');

        expect(expectIdempotent(input, profile.options).skippedRules).toEqual([]);
    });
});
