import { expectIdempotent } from './testUtils';
import type { FormatterOptions } from './types';

interface NamedInput {
    name: string;
    input: string;
}

const inputs: NamedInput[] = [
    { name: 'empty document', input: '' },
    { name: 'CRLF whitespace-only document', input: ' \t\r\n\t\r\n' },
    { name: 'CRLF document without final newline', input: '# Title\r\nBody' },
    { name: 'CRLF document with trailing blank lines', input: 'Text\r\n\r\n\r\n' },
    { name: 'CRLF hard break and trailing spaces', input: 'hard  \r\nnext   \r\n' },
    { name: 'closed CRLF fenced code block', input: '```txt\r\ncode   \r\n```\r\n\r\n' },
    { name: 'unclosed CRLF fenced code block at EOF', input: '```txt\r\ncode   \r\n\r\n' },
    { name: 'unclosed CRLF fenced code block ending in spaces', input: '```txt\r\ncode   ' },
    { name: 'unclosed CRLF HTML block at EOF', input: '<div>\r\ncontent   \r\n\r\n' },
];

type CleanupOptions = Pick<FormatterOptions, 'ensureFinalNewline' | 'trimTrailingWhitespace' | 'collapseBlankLines'>;

const cleanupProfiles: CleanupOptions[] = [];
for (const ensureFinalNewline of [false, true]) {
    for (const trimTrailingWhitespace of [false, true]) {
        for (const collapseBlankLines of [false, true]) {
            cleanupProfiles.push({ ensureFinalNewline, trimTrailingWhitespace, collapseBlankLines });
        }
    }
}

const cases = inputs.flatMap(({ name, input }) =>
    cleanupProfiles.map((options) => ({
        name: `${name} / final:${options.ensureFinalNewline} / trim:${options.trimTrailingWhitespace} / collapse:${options.collapseBlankLines}`,
        input,
        options,
    }))
);

describe('line ending and EOF idempotency', () => {
    test.each(cases)('$name', ({ input, options }) => {
        expect(expectIdempotent(input, options).skippedRules).toEqual([]);
    });
});
