import { jest } from '@jest/globals';
import { GET_NOTE_TEXT_COMMAND, SET_NOTE_TEXT_COMMAND } from '../constants';
import createCodeMirrorPlugin, { computeChanges } from './codeMirror';

/** Applies changes the way CodeMirror does: all positions refer to the original text. */
function applyChanges(oldText: string, changes: Array<{ from: number; to: number; insert: string }>): string {
    let result = oldText;
    // Apply back-to-front so earlier offsets stay valid.
    for (const { from, to, insert } of [...changes].sort((a, b) => b.from - a.from)) {
        result = result.slice(0, from) + insert + result.slice(to);
    }
    return result;
}

describe('computeChanges', () => {
    test('identical texts produce no changes', () => {
        expect(computeChanges('abc', 'abc')).toEqual([]);
    });

    test('deletion in the middle', () => {
        // Prefix matching runs first, so the removed span is the latest equivalent one.
        expect(computeChanges('a\n\n\nb', 'a\nb')).toEqual([{ from: 2, to: 4, insert: '' }]);
    });

    test('insertion at the end', () => {
        expect(computeChanges('abc', 'abc\n')).toEqual([{ from: 3, to: 3, insert: '\n' }]);
    });

    test('distant edits produce separate changes, leaving the middle untouched', () => {
        const middle = 'unchanged\n'.repeat(50);
        const changes = computeChanges(`* a\n${middle}* b`, `- a\n${middle}- b`);

        expect(changes).toHaveLength(2);
        // No change may span into the unchanged middle section.
        const middleStart = '* a\n'.length;
        const middleEnd = middleStart + middle.length;
        for (const { from, to } of changes) {
            expect(to <= middleStart || from >= middleEnd).toBe(true);
        }
    });

    test('applying the changes reproduces the new text', () => {
        const cases: Array<[string, string]> = [
            ['one\n\n\ntwo\n', 'one\n\ntwo\n'],
            ['* a\n* b', '- a\n- b'],
            ['', 'fresh'],
            ['gone', ''],
            ['aaaa', 'aa'],
            ['# Title\n\ntext  \nmore\n\n\n* item', '# Title\n\ntext\\\nmore\n\n- item'],
        ];
        for (const [oldText, newText] of cases) {
            expect(applyChanges(oldText, computeChanges(oldText, newText))).toBe(newText);
        }
    });
});

describe('CodeMirror content script commands', () => {
    function registerCommands(initialText: string) {
        let text = initialText;
        const commands = new Map<string, (...args: unknown[]) => unknown>();
        const dispatch = jest.fn((spec: { changes: Array<{ from: number; to: number; insert: string }> }) => {
            text = applyChanges(text, spec.changes);
        });

        createCodeMirrorPlugin().plugin({
            cm6: {},
            editor: {
                state: {
                    doc: {
                        toString: () => text,
                        get length() {
                            return text.length;
                        },
                    },
                },
                dispatch,
            },
            registerCommand: (name: string, callback: (...args: unknown[]) => unknown) => {
                commands.set(name, callback);
            },
        });

        return { commands, dispatch, getText: () => text };
    }

    test('GET_NOTE_TEXT_COMMAND returns the current editor text', () => {
        const { commands } = registerCommands('live text');

        expect(commands.get(GET_NOTE_TEXT_COMMAND)?.()).toBe('live text');
    });

    test('SET_NOTE_TEXT_COMMAND replaces text when the expected text still matches', () => {
        const { commands, dispatch, getText } = registerCommands('* item\ntail');

        commands.get(SET_NOTE_TEXT_COMMAND)?.('* item\ntail', '- item\ntail');

        expect(getText()).toBe('- item\ntail');
        expect(dispatch).toHaveBeenCalledTimes(1);
    });

    test('SET_NOTE_TEXT_COMMAND does not dispatch when the editor changed after formatting started', () => {
        const { commands, dispatch, getText } = registerCommands('user changed text');

        commands.get(SET_NOTE_TEXT_COMMAND)?.('stale text', 'formatted stale text');

        expect(getText()).toBe('user changed text');
        expect(dispatch).not.toHaveBeenCalled();
    });
});
