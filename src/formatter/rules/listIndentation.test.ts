import { formatMarkdown } from '../pipeline';
import type { Indentation } from '../types';

const format = (input: string, indentation: Indentation): string =>
    formatMarkdown(input, { indentation, ensureFinalNewline: false }).text;

describe('list indentation', () => {
    test('preserves a tab-indented ordered-list continuation when the content column is unchanged', () => {
        const input = '1. item\n\tcontinued';

        expect(format(input, 'tabs')).toBe(input);
    });

    test('preserves a tab-indented later paragraph when the content column is unchanged', () => {
        const input = '- item\n\n\tlater paragraph';

        expect(format(input, 'tabs')).toBe(input);
    });

    test('normalizes a four-space continuation to a tab when configured for tabs', () => {
        const input = '1. item\n    continued';
        const expected = '1. item\n\tcontinued';

        expect(format(input, 'tabs')).toBe(expected);
    });

    test('normalizes a tab-indented continuation when configured for four spaces', () => {
        const input = '1. item\n\tcontinued';
        const expected = '1. item\n    continued';

        expect(format(input, 'spaces4')).toBe(expected);
    });

    test('still shifts tab-indented continuation content when marker spacing changes its column', () => {
        const input = '1.  item\n\tcontinued';
        const expected = '1. item\n   continued';

        expect(format(input, 'tabs')).toBe(expected);
    });
});
