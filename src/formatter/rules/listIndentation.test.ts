import { formatMarkdown } from '../pipeline';
import type { Indentation } from '../types';

const format = (input: string, indentation: Indentation): string =>
    formatMarkdown(input, { indentation, ensureFinalNewline: false }).text;

interface Case {
    name: string;
    indentation: Indentation;
    input: string;
    expected: string;
}

/**
 * Continuation lines of a list item, whose leading whitespace is structural
 * and therefore re-rendered in the configured style once shifted to the
 * item's new content column.
 */
const cases: Case[] = [
    {
        name: 'preserves a tab-indented ordered-list continuation when the content column is unchanged',
        indentation: 'tabs',
        input: '1. item\n\tcontinued',
        expected: '1. item\n\tcontinued',
    },
    {
        name: 'preserves a tab-indented later paragraph when the content column is unchanged',
        indentation: 'tabs',
        input: '- item\n\n\tlater paragraph',
        expected: '- item\n\n\tlater paragraph',
    },
    {
        name: 'normalizes a four-space continuation to a tab when configured for tabs',
        indentation: 'tabs',
        input: '1. item\n    continued',
        expected: '1. item\n\tcontinued',
    },
    {
        name: 'normalizes a tab-indented continuation when configured for four spaces',
        indentation: 'spaces4',
        input: '1. item\n\tcontinued',
        expected: '1. item\n    continued',
    },
    {
        name: 'still shifts tab-indented continuation content when marker spacing changes its column',
        indentation: 'tabs',
        input: '1.  item\n\tcontinued',
        expected: '1. item\n   continued',
    },
    {
        name: 'normalizes a space-indented blockquote in a list item when configured for tabs',
        indentation: 'tabs',
        input: '- item\n\n    > quoted',
        expected: '- item\n\n\t> quoted',
    },
    {
        name: 'normalizes a space-indented table in a list item when configured for tabs',
        indentation: 'tabs',
        input: '- item\n\n    | a | b |\n    | - | - |',
        expected: '- item\n\n\t| a | b |\n\t| - | - |',
    },
    {
        name: 'normalizes a space-indented heading in a list item when configured for tabs',
        indentation: 'tabs',
        input: '- item\n\n    # heading',
        expected: '- item\n\n\t# heading',
    },
    {
        name: 'normalizes a tab-indented blockquote in a list item when configured for four spaces',
        indentation: 'spaces4',
        input: '- item\n\n\t> quoted',
        expected: '- item\n\n    > quoted',
    },
    {
        name: 'normalizes the prefix of a quoted code fence without touching the quoted content',
        indentation: 'tabs',
        input: '- item\n\n    > ```\n    > code\n    > ```',
        expected: '- item\n\n\t> ```\n\t> code\n\t> ```',
    },
];

/**
 * Literal-content blocks, whose body lines carry indentation that renders
 * verbatim. Their prefix is shifted when the item's content column moves, but
 * the columns beyond it are never re-rendered.
 */
const literalContentCases: Case[] = [
    {
        name: 'leaves a tab-indented code fence alone when the content column is unchanged',
        indentation: 'tabs',
        input: '- item\n\n\t```\n\tcode\n\t```',
        expected: '- item\n\n\t```\n\tcode\n\t```',
    },
    {
        name: 'leaves a space-indented code fence alone in tabs mode when the content column is unchanged',
        indentation: 'tabs',
        input: '- item\n\n    ```\n    code\n    ```',
        expected: '- item\n\n    ```\n    code\n    ```',
    },
    {
        name: 'leaves a space-indented HTML block alone in tabs mode when the content column is unchanged',
        indentation: 'tabs',
        input: '- item\n\n    <div>\n    x\n    </div>',
        expected: '- item\n\n    <div>\n    x\n    </div>',
    },
    {
        name: 'preserves indentation inside a code block when the content column moves',
        indentation: 'tabs',
        input: '1.  item\n\n    ```\n    def f():\n        return 1\n    ```',
        expected: '1. item\n\n   ```\n   def f():\n       return 1\n   ```',
    },
];

describe('list indentation', () => {
    test.each(cases)('$name', ({ indentation, input, expected }) => {
        expect(format(input, indentation)).toBe(expected);
    });

    test.each(literalContentCases)('$name', ({ indentation, input, expected }) => {
        expect(format(input, indentation)).toBe(expected);
    });

    // A code fence under a `- ` marker cannot be re-rendered as a tab: the
    // content column is narrower than the tab width, and the columns past it
    // may belong to the code. Everything structural does make the trip back.
    test('restores the indentation style of structural blocks across a tabs/spaces round trip', () => {
        const original = '- item\n\n\t> quoted\n\n\t```\n\tcode\n\t```\n\n\tparagraph';
        const asSpaces = '- item\n\n    > quoted\n\n    ```\n    code\n    ```\n\n    paragraph';

        expect(format(original, 'spaces4')).toBe(asSpaces);
        expect(format(asSpaces, 'tabs')).toBe('- item\n\n\t> quoted\n\n    ```\n    code\n    ```\n\n\tparagraph');
    });
});
