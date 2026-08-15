import { formatMarkdown } from '../pipeline';

describe('list indentation', () => {
    test('preserves a tab-indented ordered-list continuation when the content column is unchanged', () => {
        const input = '1. item\n\tcontinued';

        expect(formatMarkdown(input, { indentation: 'tabs', ensureFinalNewline: false }).text).toBe(input);
    });

    test('preserves a tab-indented later paragraph when the content column is unchanged', () => {
        const input = '- item\n\n\tlater paragraph';

        expect(formatMarkdown(input, { indentation: 'tabs', ensureFinalNewline: false }).text).toBe(input);
    });

    test('normalizes a tab-indented continuation when configured for four spaces', () => {
        const input = '1. item\n\tcontinued';
        const expected = '1. item\n    continued';

        expect(formatMarkdown(input, { indentation: 'spaces4', ensureFinalNewline: false }).text).toBe(expected);
    });

    test('still shifts tab-indented continuation content when marker spacing changes its column', () => {
        const input = '1.  item\n\tcontinued';
        const expected = '1. item\n   continued';

        expect(formatMarkdown(input, { indentation: 'tabs', ensureFinalNewline: false }).text).toBe(expected);
    });
});
