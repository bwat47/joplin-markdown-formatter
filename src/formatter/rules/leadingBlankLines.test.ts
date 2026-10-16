import { expectIdempotent } from '../testUtils';

const options = {
    collapseBlankLines: false,
    trimTrailingWhitespace: false,
    ensureFinalNewline: false,
};

describe('leadingBlankLines', () => {
    test.each([
        { name: 'LF blank lines', input: '\n\nText', expected: 'Text' },
        { name: 'CRLF blank lines', input: '\r\n \t\r\nText', expected: 'Text' },
        { name: 'whitespace-only document', input: '\n  \n', expected: '' },
        { name: 'no leading blank lines', input: 'Text\n', expected: 'Text\n' },
        { name: 'indented first line', input: '  Text', expected: '  Text' },
    ])('$name', ({ input, expected }) => {
        expect(expectIdempotent(input, options)).toEqual({ text: expected, skippedRules: [] });
    });

    test('keeps the indentation of a leading indented code block', () => {
        const input = '\n \n    code\n';

        expect(expectIdempotent(input, options)).toEqual({ text: '    code\n', skippedRules: [] });
    });

    test('keeps blank lines that stop a --- block from becoming front matter', () => {
        const input = '\n\n---\n\ntitle: Note\n---\n';

        expect(expectIdempotent(input, { ...options, thematicBreakMarker: '---' })).toEqual({
            text: input,
            skippedRules: [],
        });
    });

    test('keeps existing front matter at the start of the document', () => {
        const input = '---\ntitle: Note\n---\n\nBody.';

        expect(expectIdempotent(input, options)).toEqual({ text: input, skippedRules: [] });
    });
});
