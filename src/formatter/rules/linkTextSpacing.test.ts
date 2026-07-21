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

    test('drops a trailing newline inside link text', () => {
        expect(format('[a link\n](https://www.example.com/)')).toBe('[a link](https://www.example.com/)');
    });

    test('converts an internal newline to a space', () => {
        expect(format('[a link\ntest](https://www.example.com/)')).toBe('[a link test](https://www.example.com/)');
    });

    test('preserves single spaces that separate inline nodes mid-text', () => {
        expect(format('[ a *b* c ](https://www.example.com/)')).toBe('[a *b* c](https://www.example.com/)');
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

    test('is a no-op when disabled', () => {
        const input = '[ a link ](https://www.example.com/)';
        expect(formatMarkdown(input, { ...options, normalizeLinkTextSpacing: false }).text).toBe(input);
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
});
