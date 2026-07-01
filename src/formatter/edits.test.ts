import { applyEdits } from './edits';

describe('applyEdits', () => {
    test('returns text unchanged for no edits', () => {
        expect(applyEdits('abc', [])).toBe('abc');
    });

    test('applies a single replacement', () => {
        expect(applyEdits('hello world', [{ start: 6, end: 11, replacement: 'there' }])).toBe('hello there');
    });

    test('applies insertions and deletions', () => {
        expect(applyEdits('abc', [{ start: 3, end: 3, replacement: 'd' }])).toBe('abcd');
        expect(applyEdits('abc', [{ start: 1, end: 2, replacement: '' }])).toBe('ac');
    });

    test('applies multiple edits regardless of input order', () => {
        const edits = [
            { start: 7, end: 8, replacement: 'X' },
            { start: 0, end: 1, replacement: 'Y' },
        ];
        expect(applyEdits('abcdefghi', edits)).toBe('YbcdefgXi');
    });

    test('allows adjacent edits', () => {
        const edits = [
            { start: 0, end: 2, replacement: '1' },
            { start: 2, end: 4, replacement: '2' },
        ];
        expect(applyEdits('abcd', edits)).toBe('12');
    });

    test('throws on overlapping edits', () => {
        const edits = [
            { start: 0, end: 3, replacement: 'x' },
            { start: 2, end: 5, replacement: 'y' },
        ];
        expect(() => applyEdits('abcdef', edits)).toThrow('Overlapping');
    });

    test('throws on out-of-bounds edits', () => {
        expect(() => applyEdits('abc', [{ start: 2, end: 9, replacement: 'x' }])).toThrow('out of bounds');
        expect(() => applyEdits('abc', [{ start: 2, end: 1, replacement: 'x' }])).toThrow('out of bounds');
    });
});
