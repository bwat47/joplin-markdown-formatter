/**
 * CodeMirror 6 content script.
 *
 * Registers an editor command that replaces the note text through a normal
 * CodeMirror transaction, so the change lands in the editor's undo history —
 * unlike the built-in `editor.setText`, which reloads the content and cannot
 * be undone. Only the changed span is replaced, which also keeps the cursor
 * and scroll position stable whenever the edit is elsewhere in the document.
 */

import { SET_NOTE_TEXT_COMMAND } from '../constants';

interface EditorViewLike {
    state: { doc: { toString(): string; length: number } };
    dispatch(spec: { changes: { from: number; to: number; insert: string } }): void;
}

/** Narrow view of Joplin's CodeMirrorControl (CM6 wrapper); absent members mean the legacy CM5 editor. */
interface CodeMirrorControlLike {
    cm6?: unknown;
    editor?: EditorViewLike;
    registerCommand?(name: string, callback: (...args: unknown[]) => unknown): void;
}

/**
 * Smallest single change turning `oldText` into `newText`, found by trimming
 * the common prefix and suffix. E.g. "a\n\n\nb" -> "a\nb" yields
 * { from: 1, to: 3, insert: '' }.
 */
export function computeMinimalChange(oldText: string, newText: string): { from: number; to: number; insert: string } {
    let prefix = 0;
    const maxPrefix = Math.min(oldText.length, newText.length);
    while (prefix < maxPrefix && oldText[prefix] === newText[prefix]) prefix++;

    let oldEnd = oldText.length;
    let newEnd = newText.length;
    while (oldEnd > prefix && newEnd > prefix && oldText[oldEnd - 1] === newText[newEnd - 1]) {
        oldEnd--;
        newEnd--;
    }

    return { from: prefix, to: oldEnd, insert: newText.slice(prefix, newEnd) };
}

export default () => {
    return {
        plugin: (codeMirror: CodeMirrorControlLike) => {
            // The legacy CodeMirror 5 editor passes a different wrapper; skip it.
            if (!codeMirror.cm6 || !codeMirror.editor || !codeMirror.registerCommand) return;

            codeMirror.registerCommand(SET_NOTE_TEXT_COMMAND, (newText: unknown) => {
                if (typeof newText !== 'string') return;
                const view = codeMirror.editor as EditorViewLike;
                const currentText = view.state.doc.toString();
                if (newText === currentText) return;
                view.dispatch({ changes: computeMinimalChange(currentText, newText) });
            });
        },
    };
};
