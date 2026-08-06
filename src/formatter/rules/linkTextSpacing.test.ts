import { formatMarkdown } from '../pipeline';

const options = {
    collapseBlankLines: false,
    ensureFinalNewline: false,
};

const format = (input: string): string => formatMarkdown(input, options).text;

describe('linkTextSpacing', () => {
    test('trims leading and trailing whitespace inside link text', () => {
        expect(format('[ a link ](https://www.example.com/)')).toBe('[a link](https://www.example.com/)');
    });

    test('collapses internal whitespace runs to a single space', () => {
        expect(format('[a     link](https://www.example.com/)')).toBe('[a link](https://www.example.com/)');
    });

    test('collapses whitespace inside formatted link text', () => {
        const input =
            '[  **How Do I Properly Install       KVM on Linux**  ](https://sysguides.com/install-kvm-on-linux)';
        const expected = '[**How Do I Properly Install KVM on Linux**](https://sysguides.com/install-kvm-on-linux)';
        expect(format(input)).toBe(expected);
    });

    test('drops a trailing newline inside link text', () => {
        expect(format('[a link\n](https://www.example.com/)')).toBe('[a link](https://www.example.com/)');
    });

    test('converts an internal newline to a space', () => {
        expect(format('[a link\ntest](https://www.example.com/)')).toBe('[a link test](https://www.example.com/)');
    });

    test('preserves single spaces that separate inline nodes mid-text', () => {
        expect(format('[ a *b* c ](https://www.example.com/)')).toBe('[a *b* c](https://www.example.com/)');
    });

    test('trims whitespace-only boundary nodes around inline content', () => {
        const input = '[ *bold* and `code` ](https://www.example.com/)';
        const result = formatMarkdown(input, options);
        expect(result.text).toBe('[*bold* and `code`](https://www.example.com/)');
        expect(result.skippedRules).not.toContain('linkTextSpacing');
    });

    test('trims whitespace-only boundary nodes in reference-link text', () => {
        const input = ['[ *bold* ][ref]', '', '[ref]: https://www.example.com/'].join('\n');
        const expected = ['[*bold*][ref]', '', '[ref]: https://www.example.com/'].join('\n');
        const result = formatMarkdown(input, options);
        expect(result.text).toBe(expected);
        expect(result.skippedRules).not.toContain('linkTextSpacing');
    });

    test('leaves whitespace inside inline code within link text untouched', () => {
        expect(format('[a  `x  y`  b](https://www.example.com/)')).toBe('[a `x  y` b](https://www.example.com/)');
    });

    test('normalizes full reference link labels without touching the reference', () => {
        const input = ['[ text ][ref]', '', '[ref]: https://www.example.com/'].join('\n');
        const expected = ['[text][ref]', '', '[ref]: https://www.example.com/'].join('\n');
        expect(format(input)).toBe(expected);
    });

    test('normalizes shortcut reference labels while keeping them resolvable', () => {
        const input = ['[ Foo ]', '', '[Foo]: https://www.example.com/'].join('\n');
        const expected = ['[Foo]', '', '[Foo]: https://www.example.com/'].join('\n');
        expect(format(input)).toBe(expected);
    });

    test('leaves autolinks unchanged', () => {
        expect(format('<https://www.example.com/>')).toBe('<https://www.example.com/>');
    });

    test('is a no-op when set to preserve', () => {
        const input = '[ a link ](https://www.example.com/)';
        expect(formatMarkdown(input, { ...options, linkTextSpacing: 'preserve' }).text).toBe(input);
    });

    test('is not dropped by structural verification', () => {
        const result = formatMarkdown('[ a link ](https://www.example.com/)', options);
        expect(result.skippedRules).not.toContain('linkTextSpacing');
        expect(result.text).toBe('[a link](https://www.example.com/)');
    });

    test('is idempotent', () => {
        const once = format('[ a   link\ntest ](https://www.example.com/)');
        expect(format(once)).toBe(once);
    });

    describe('whitespace around a soft line break', () => {
        // CommonMark strips the whitespace bordering a soft line ending, and mdast
        // positions follow, so those spaces sit outside every node's span. One
        // format run has to collapse them together with the neighboring text.
        test('collapses the space before a newline that follows an inline node', () => {
            const input = '[  a **google     link** \ntext123             ](https://google.com)';
            const expected = '[a **google link** text123](https://google.com)';
            expect(format(input)).toBe(expected);
        });

        test('collapses continuation-line indentation before an inline node', () => {
            expect(format('[a\n   **b**](https://www.example.com/)')).toBe('[a **b**](https://www.example.com/)');
        });

        test('collapses a newline between two inline nodes', () => {
            expect(format('[**b** \n **c**](https://www.example.com/)')).toBe(
                '[**b** **c**](https://www.example.com/)'
            );
        });

        test('drops a trailing newline that follows an inline node', () => {
            expect(format('[a **b** \n](https://www.example.com/)')).toBe('[a **b**](https://www.example.com/)');
        });

        test('trims a leading space that precedes a newline', () => {
            expect(format('[ \n a](https://www.example.com/)')).toBe('[a](https://www.example.com/)');
        });

        // The gap can sit between the children of any inline container, not just
        // between the link's own children.
        test('collapses the space before a newline nested inside strong', () => {
            expect(format('[**a *b* \nc**](https://www.example.com/)')).toBe('[**a *b* c**](https://www.example.com/)');
        });

        test('collapses the space before a newline nested inside emphasis', () => {
            expect(format('[*a **b** \nc*](https://www.example.com/)')).toBe('[*a **b** c*](https://www.example.com/)');
        });

        test('collapses the space after nested inline code', () => {
            expect(format('[**a `x  y` \nb**](https://www.example.com/)')).toBe(
                '[**a `x  y` b**](https://www.example.com/)'
            );
        });

        test('collapses the space before a newline nested inside strikethrough', () => {
            expect(format('[~~a *b* \nc~~](https://www.example.com/)')).toBe('[~~a *b* c~~](https://www.example.com/)');
        });

        test('collapses gaps two container levels deep', () => {
            expect(format('[**a *b `c` \nd* e**](https://www.example.com/)')).toBe(
                '[**a *b `c` d* e**](https://www.example.com/)'
            );
        });

        test('collapses a newline between two nested inline nodes', () => {
            expect(format('[**a *b* \n *c* d**](https://www.example.com/)')).toBe(
                '[**a *b* *c* d**](https://www.example.com/)'
            );
        });

        test('collapses continuation-line indentation nested inside strong', () => {
            expect(format('[**a *b*\n   c**](https://www.example.com/)')).toBe(
                '[**a *b* c**](https://www.example.com/)'
            );
        });
    });

    describe('hard line breaks', () => {
        test('collapses a hard break and the indentation after it to one space', () => {
            expect(format('[a   \n   b](https://www.example.com/)')).toBe('[a b](https://www.example.com/)');
        });

        test('collapses a hard break nested inside strong', () => {
            expect(format('[**a *b*   \nc**](https://www.example.com/)')).toBe(
                '[**a *b* c**](https://www.example.com/)'
            );
        });

        test('collapses the backslash form of a hard break', () => {
            expect(format('[a\\\nb](https://www.example.com/)')).toBe('[a b](https://www.example.com/)');
        });

        test('collapses a hard break between two inline nodes', () => {
            expect(format('[**a**  \n**b**](https://www.example.com/)')).toBe(
                '[**a** **b**](https://www.example.com/)'
            );
        });

        test('drops a trailing hard break', () => {
            expect(format('[a  \n](https://www.example.com/)')).toBe('[a](https://www.example.com/)');
        });

        test('keeps an escaped backslash before a soft break', () => {
            // `a\\` + newline is an escaped backslash and a *soft* break, not a hard
            // break, even though the raw text looks like the case above.
            expect(format('[a\\\\\nb](https://www.example.com/)')).toBe('[a\\\\ b](https://www.example.com/)');
        });

        test('is not dropped by structural verification', () => {
            const result = formatMarkdown('[a  \nb](https://www.example.com/)', options);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
            expect(result.text).toBe('[a b](https://www.example.com/)');
        });

        test('leaves hard breaks outside link text alone', () => {
            expect(format('a  \nb [c](https://www.example.com/)')).toBe('a  \nb [c](https://www.example.com/)');
        });
    });

    describe('links inside blockquotes', () => {
        // A quoted continuation line opens with a `>` that sits inside the link's
        // source range without being part of the label, so multi-line links there
        // are left alone.
        test('leaves a multi-line link as written', () => {
            const input = '> [a  \n> b](https://www.example.com/)';
            const result = formatMarkdown(input, options);
            expect(result.text).toBe(input);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
        });

        test('still normalizes a single-line link', () => {
            expect(format('> [ a  link ](https://www.example.com/)')).toBe('> [a link](https://www.example.com/)');
        });

        test('still normalizes other links in the same note', () => {
            const input = ['> [a  ', '> b](https://www.example.com/)', '', '[ c  d ](https://www.example.com/)'].join(
                '\n'
            );
            const expected = ['> [a  ', '> b](https://www.example.com/)', '', '[c d](https://www.example.com/)'].join(
                '\n'
            );
            const result = formatMarkdown(input, options);
            expect(result.text).toBe(expected);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
        });
    });

    describe("'spaces' mode", () => {
        const formatSpaces = (input: string): string =>
            formatMarkdown(input, { ...options, linkTextSpacing: 'spaces' }).text;

        test('collapses and trims whitespace within a line', () => {
            expect(formatSpaces('[  a   link  ](https://www.example.com/)')).toBe('[a link](https://www.example.com/)');
        });

        test('collapses whitespace inside nested inline formatting', () => {
            expect(formatSpaces('[ **a   b** ](https://www.example.com/)')).toBe('[**a b**](https://www.example.com/)');
        });

        test('leaves a soft line break as written', () => {
            const input = '[a\nb](https://www.example.com/)';
            const result = formatMarkdown(input, { ...options, linkTextSpacing: 'spaces' });
            expect(result.text).toBe(input);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
        });

        test('leaves a hard line break as written', () => {
            const input = '[a  \nb](https://www.example.com/)';
            const result = formatMarkdown(input, {
                ...options,
                linkTextSpacing: 'spaces',
                trimTrailingWhitespace: false,
            });
            expect(result.text).toBe(input);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
        });

        test('leaves the whitespace bordering a line break alone', () => {
            // The space before the break and the indentation after it are part of
            // the same whitespace run as the break itself, so all of it is frozen.
            const input = '[a **b** \n   c](https://www.example.com/)';
            const result = formatMarkdown(input, {
                ...options,
                linkTextSpacing: 'spaces',
                trimTrailingWhitespace: false,
            });
            expect(result.text).toBe(input);
        });

        test('still normalizes a single-line link elsewhere in the note', () => {
            const input = ['[a\nb](https://www.example.com/)', '', '[ c  d ](https://www.example.com/)'].join('\n');
            const expected = ['[a\nb](https://www.example.com/)', '', '[c d](https://www.example.com/)'].join('\n');
            expect(formatSpaces(input)).toBe(expected);
        });

        test('normalizes each line of a multi-line label', () => {
            const input = '[  a **google     link** \ntext123             ](https://www.example.com/)';
            const expected = '[a **google link**\ntext123](https://www.example.com/)';
            const result = formatMarkdown(input, { ...options, linkTextSpacing: 'spaces' });
            expect(result.text).toBe(expected);
            expect(result.skippedRules).not.toContain('linkTextSpacing');
        });

        test('trims the label boundaries even when the label spans lines', () => {
            expect(formatSpaces('[  a\nb  ](https://www.example.com/)')).toBe('[a\nb](https://www.example.com/)');
        });

        test('leaves a boundary whitespace run that reaches the bracket across a line break', () => {
            // The indentation before `]` is part of the same run as the break, so
            // trimming at the bracket must not nibble at it.
            const input = '[a\n  ](https://www.example.com/)';
            const result = formatMarkdown(input, {
                ...options,
                linkTextSpacing: 'spaces',
                trimTrailingWhitespace: false,
            });
            expect(result.text).toBe(input);
        });

        test('is idempotent', () => {
            const once = formatSpaces('[  a   link\n  test  ](https://www.example.com/)');
            expect(formatSpaces(once)).toBe(once);
        });
    });
});
