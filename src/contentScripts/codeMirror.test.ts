import { computeMinimalChange } from './codeMirror';

describe('computeMinimalChange', () => {
    test('identical texts produce an empty change', () => {
        expect(computeMinimalChange('abc', 'abc')).toEqual({ from: 3, to: 3, insert: '' });
    });

    test('deletion in the middle', () => {
        // Prefix matching runs first, so the removed span is the latest equivalent one.
        expect(computeMinimalChange('a\n\n\nb', 'a\nb')).toEqual({ from: 2, to: 4, insert: '' });
    });

    test('insertion at the end', () => {
        expect(computeMinimalChange('abc', 'abc\n')).toEqual({ from: 3, to: 3, insert: '\n' });
    });

    test('replacement in the middle keeps prefix and suffix', () => {
        expect(computeMinimalChange('* item\ntail', '- item\ntail')).toEqual({ from: 0, to: 1, insert: '-' });
    });

    test('applying the change reproduces the new text', () => {
        const cases: Array<[string, string]> = [
            ['one\n\n\ntwo\n', 'one\n\ntwo\n'],
            ['* a\n* b', '- a\n- b'],
            ['', 'fresh'],
            ['gone', ''],
            ['aaaa', 'aa'],
        ];
        for (const [oldText, newText] of cases) {
            const { from, to, insert } = computeMinimalChange(oldText, newText);
            expect(oldText.slice(0, from) + insert + oldText.slice(to)).toBe(newText);
        }
    });
});
