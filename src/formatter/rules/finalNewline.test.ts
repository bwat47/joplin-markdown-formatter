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
});
