import { computeLineDiff, type DiffHunk, type DiffLine } from './lineDiff';

function text(line: DiffLine): string {
    return line.segments.map((segment) => segment.text).join('');
}

function rows(hunk: DiffHunk): string[] {
    return hunk.lines.map((line) => `${line.kind[0]} ${text(line)}`);
}

function changedSpans(line: DiffLine): string[] {
    return line.segments.filter((segment) => segment.changed).map((segment) => segment.text);
}

describe('computeLineDiff', () => {
    test('returns no hunks for identical text', () => {
        expect(computeLineDiff('a\nb\n', 'a\nb\n')).toEqual([]);
    });

    test('pairs a replaced line and numbers both sides', () => {
        const [hunk] = computeLineDiff('intro\n* item\ntail\n', 'intro\n- item\ntail\n');

        expect(rows(hunk)).toEqual(['c intro', 'r * item', 'a - item', 'c tail']);
        expect(hunk).toMatchObject({ oldStart: 1, oldCount: 3, newStart: 1, newCount: 3 });

        const removed = hunk.lines[1];
        const added = hunk.lines[2];
        expect(removed.oldNumber).toBe(2);
        expect(removed.newNumber).toBeNull();
        expect(added.oldNumber).toBeNull();
        expect(added.newNumber).toBe(2);
    });

    test('highlights only the changed characters of a replaced line', () => {
        const [hunk] = computeLineDiff('* item one\n', '- item one\n');

        expect(changedSpans(hunk.lines[0])).toEqual(['*']);
        expect(changedSpans(hunk.lines[1])).toEqual(['-']);
    });

    test('highlights trimmed trailing whitespace', () => {
        const [hunk] = computeLineDiff('text  \n', 'text\n');

        expect(changedSpans(hunk.lines[0])).toEqual(['  ']);
        expect(changedSpans(hunk.lines[1])).toEqual([]);
    });

    test('leaves unrelated lines unhighlighted rather than pairing them character by character', () => {
        const [hunk] = computeLineDiff('# Heading\n', 'a completely different line\n');

        expect(changedSpans(hunk.lines[0])).toEqual([]);
        expect(changedSpans(hunk.lines[1])).toEqual([]);
    });

    test('aligns runs of unequal length by similarity', () => {
        // Two rewritten lines against three added ones: the inserted blank line
        // must not push the second pair out of alignment.
        const [hunk] = computeLineDiff('### Head\n| a | b |\n', '## Head\n\n| a   | b   |\n');

        expect(rows(hunk)).toEqual(['r ### Head', 'r | a | b |', 'a ## Head', 'a ', 'a | a   | b   |']);
        expect(changedSpans(hunk.lines[0])).toEqual(['#']);
        expect(changedSpans(hunk.lines[1])).toEqual([]);
        expect(changedSpans(hunk.lines[3])).toEqual([]);
        expect(changedSpans(hunk.lines[4])).toEqual(['  ', '  ']);
    });

    test('leaves a line with no counterpart unpaired', () => {
        const [hunk] = computeLineDiff('keep me\n', 'keep me\nbrand new line\n');

        for (const line of hunk.lines) {
            expect(changedSpans(line)).toEqual([]);
        }
    });

    test('trims unchanged text to the configured context', () => {
        const oldText = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');
        const newText = oldText.replace('line 7', 'LINE 7');

        const [hunk] = computeLineDiff(oldText, newText, 2);

        expect(rows(hunk)).toEqual(['c line 5', 'c line 6', 'r line 7', 'a LINE 7', 'c line 8', 'c line 9']);
        expect(hunk).toMatchObject({ oldStart: 5, newStart: 5 });
    });

    test('splits distant changes into separate hunks', () => {
        const oldText = Array.from({ length: 30 }, (_, index) => `line ${index + 1}`).join('\n');
        const newText = oldText.replace('line 3', 'LINE 3').replace('line 25', 'LINE 25');

        const hunks = computeLineDiff(oldText, newText, 2);

        expect(hunks).toHaveLength(2);
        expect(hunks[0].lines.map(text)).toContain('LINE 3');
        expect(hunks[1].lines.map(text)).toContain('LINE 25');
    });

    test('keeps nearby changes in one hunk', () => {
        const oldText = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join('\n');
        const newText = oldText.replace('line 4', 'LINE 4').replace('line 7', 'LINE 7');

        const hunks = computeLineDiff(oldText, newText, 2);

        expect(hunks).toHaveLength(1);
        expect(rows(hunks[0])).toEqual([
            'c line 2',
            'c line 3',
            'r line 4',
            'a LINE 4',
            'c line 5',
            'c line 6',
            'r line 7',
            'a LINE 7',
            'c line 8',
            'c line 9',
        ]);
    });

    test('starts an empty side at the line it follows, not at line 1', () => {
        // Unified-diff convention for a zero-length range, as `git diff` emits it.
        const [deletion] = computeLineDiff('a\nb\n', '');
        expect(deletion).toMatchObject({ oldStart: 1, oldCount: 2, newStart: 0, newCount: 0 });

        const [insertion] = computeLineDiff('', 'a\nb\n');
        expect(insertion).toMatchObject({ oldStart: 0, oldCount: 0, newStart: 1, newCount: 2 });
    });

    test('keeps a non-empty side anchored to its first line', () => {
        // The same anchor drives both cases, so a replaced line must still report 1.
        const [hunk] = computeLineDiff('a\n', 'b\n');
        expect(hunk).toMatchObject({ oldStart: 1, oldCount: 1, newStart: 1, newCount: 1 });
    });

    test('flags a final line with no trailing newline', () => {
        const [hunk] = computeLineDiff('a\nb', 'a\nb\n');

        expect(hunk.lines.map((line) => [line.kind, line.missingFinalNewline])).toEqual([
            ['context', false],
            ['remove', true],
            ['add', false],
        ]);
    });

    test('reports insertion positions on the side that does not number them', () => {
        const [hunk] = computeLineDiff('a\nb\n', 'a\nnew\nb\n');

        expect(rows(hunk)).toEqual(['c a', 'a new', 'c b']);
        expect(hunk).toMatchObject({ oldStart: 1, oldCount: 2, newStart: 1, newCount: 3 });
    });
});
