import { jest } from '@jest/globals';
import { GET_NOTE_TEXT_COMMAND, SET_NOTE_TEXT_COMMAND } from '../constants';
import createCodeMirrorPlugin, { computeMinimalChange } from './codeMirror';

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

describe('CodeMirror content script commands', () => {
    function registerCommands(initialText: string) {
        let text = initialText;
        const commands = new Map<string, (...args: unknown[]) => unknown>();
        const dispatch = jest.fn((spec: { changes: { from: number; to: number; insert: string } }) => {
            const { from, to, insert } = spec.changes;
            text = text.slice(0, from) + insert + text.slice(to);
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
        expect(dispatch).toHaveBeenCalledWith({ changes: { from: 0, to: 1, insert: '-' } });
    });

    test('SET_NOTE_TEXT_COMMAND does not dispatch when the editor changed after formatting started', () => {
        const { commands, dispatch, getText } = registerCommands('user changed text');

        commands.get(SET_NOTE_TEXT_COMMAND)?.('stale text', 'formatted stale text');

        expect(getText()).toBe('user changed text');
        expect(dispatch).not.toHaveBeenCalled();
    });
});
