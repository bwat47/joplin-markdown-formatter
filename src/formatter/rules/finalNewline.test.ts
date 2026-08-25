import { expectIdempotent } from '../testUtils';

const options = {
    collapseBlankLines: false,
    trimTrailingWhitespace: false,
};

describe('finalNewline', () => {
    test('does not repeatedly propose a newline inside an open fenced block', () => {
        const input = '```txt\r\ncode   \r\n\r\n';

        expect(expectIdempotent(input, options)).toEqual({ text: input, skippedRules: [] });
    });

    test('appends one newline after protected trailing spaces and then reaches a clean fixed point', () => {
        const input = '```txt\r\ncode   ';

        expect(expectIdempotent(input, options)).toEqual({ text: `${input}\n`, skippedRules: [] });
    });

    // A closed protected block whose last line carries trailing spaces reaches
    // past the trailing whitespace run without owning EOF, so the blank lines
    // after it are still ordinary trailing whitespace and must be trimmed.
    test.each([
        { name: 'fenced code', input: '```txt\ncode\n```   \n\n\n', expected: '```txt\ncode\n```   \n' },
        { name: 'html', input: '<div>\nx\n</div>   \n\n\n', expected: '<div>\nx\n</div>   \n' },
        { name: 'math', input: '$$\nx\n$$   \n\n\n', expected: '$$\nx\n$$   \n' },
    ])('trims trailing blank lines after a closed $name block', ({ input, expected }) => {
        expect(expectIdempotent(input, options)).toEqual({ text: expected, skippedRules: [] });
    });
});
