import { computeCharacterChangeStats, formatCharacterChangeStats } from './changeStats';

describe('computeCharacterChangeStats', () => {
    test('returns zeroes for identical text', () => {
        expect(computeCharacterChangeStats('abc', 'abc')).toEqual({ added: 0, removed: 0 });
    });

    test('counts insertions and deletions separately', () => {
        expect(computeCharacterChangeStats('abc', 'abXYZ')).toEqual({ added: 3, removed: 1 });
    });

    test('counts formatting replacements as removed and added characters', () => {
        expect(computeCharacterChangeStats('* item\ntext  \n', '- item\ntext\\\n')).toEqual({ added: 2, removed: 3 });
    });
});

describe('formatCharacterChangeStats', () => {
    test('formats plural labels', () => {
        expect(formatCharacterChangeStats({ added: 2, removed: 0 })).toBe('2 characters added, 0 characters removed');
    });

    test('formats singular labels', () => {
        expect(formatCharacterChangeStats({ added: 1, removed: 1 })).toBe('1 character added, 1 character removed');
    });
});
