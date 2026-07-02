import { formatMarkdown } from '../pipeline';

const options = {
    collapseBlankLines: false,
    ensureFinalNewline: false,
};

describe('trimTrailingWhitespace', () => {
    test('trims trailing spaces and tabs outside protected ranges', () => {
        const input = ['one ', 'hard   ', 'tabs\t\t', 'mixed \t ', '', 'next'].join('\n');
        const expected = ['one', 'hard  ', 'tabs', 'mixed', '', 'next'].join('\n');

        expect(formatMarkdown(input, options).text).toBe(expected);
    });

    test('preserves exactly two spaces for hard line breaks on non-blank lines', () => {
        const input = ['hard  ', 'extra hard    ', 'not hard ', '   ', 'next'].join('\n');
        const expected = ['hard  ', 'extra hard  ', 'not hard', '', 'next'].join('\n');

        expect(formatMarkdown(input, options).text).toBe(expected);
    });

    test('preserves trailing whitespace inside fenced code blocks', () => {
        const input = ['```txt', 'code   ', '```', '', 'outside   '].join('\n');
        const expected = ['```txt', 'code   ', '```', '', 'outside'].join('\n');

        expect(formatMarkdown(input, options).text).toBe(expected);
    });

    test('can be disabled', () => {
        const input = ['plain   ', 'next'].join('\n');

        expect(formatMarkdown(input, { ...options, trimTrailingWhitespace: false }).text).toBe(input);
    });
});
