/**
 * CodeMirror 6 content script.
 *
 * Registers editor commands that read and replace the live note text. Replacing
 * goes through a normal CodeMirror transaction, so the change lands in the
 * editor's undo history — unlike the built-in `editor.setText`, which reloads
 * the content and cannot be undone. The old and new text are diffed and only
 * the changed spans are replaced, all in a single transaction, so the cursor
 * and scroll position stay anchored to the unchanged text around them.
 */

import { diffMain, diffCleanupEfficiency, DIFF_EQUAL, DIFF_DELETE } from 'diff-match-patch-es';
import { GET_NOTE_TEXT_COMMAND, SET_NOTE_TEXT_COMMAND } from '../constants';

interface ChangeSpec {
    from: number;
    to: number;
    insert: string;
}

interface EditorViewLike {
    state: { doc: { toString(): string; length: number } };
    dispatch(spec: { changes: ChangeSpec[] }): void;
}

/** Narrow view of Joplin's CodeMirrorControl (CM6 wrapper); absent members mean the legacy CM5 editor. */
interface CodeMirrorControlLike {
    cm6?: unknown;
    editor?: EditorViewLike;
    registerCommand?(name: string, callback: (...args: unknown[]) => unknown): void;
}

/**
 * Diffs `oldText` against `newText` and returns one change span per edited
 * region, with `from`/`to` addressed in `oldText` coordinates — the shape
 * CodeMirror expects for an array of changes in a single transaction.
 * E.g. "* a\ntext\n* b" -> "- a\ntext\n- b" yields
 * [{ from: 0, to: 1, insert: '-' }, { from: 9, to: 10, insert: '-' }].
 *
 * diff-match-patch measures in UTF-16 code units, matching CodeMirror's
 * document offsets, so positions transfer directly.
 */
export function computeChanges(oldText: string, newText: string): ChangeSpec[] {
    const diffs = diffMain(oldText, newText);
    // Merge noisy micro-edits (e.g. single-character chunks) into larger spans.
    diffCleanupEfficiency(diffs);

    const changes: ChangeSpec[] = [];
    let pos = 0;
    for (const [op, text] of diffs) {
        if (op === DIFF_EQUAL) {
            pos += text.length;
        } else if (op === DIFF_DELETE) {
            changes.push({ from: pos, to: pos + text.length, insert: '' });
            pos += text.length;
        } else {
            // The diff emits a replacement as a deletion followed by an
            // insertion; fold those back into a single replace span.
            const last = changes[changes.length - 1];
            if (last && last.to === pos && last.insert === '') {
                last.insert = text;
            } else {
                // Insertion: anchors at the current position, consumes no old text.
                changes.push({ from: pos, to: pos, insert: text });
            }
        }
    }
    return changes;
}

export default () => {
    return {
        plugin: (codeMirror: CodeMirrorControlLike) => {
            // The legacy CodeMirror 5 editor passes a different wrapper; skip it.
            if (!codeMirror.cm6 || !codeMirror.editor || !codeMirror.registerCommand) return;

            codeMirror.registerCommand(GET_NOTE_TEXT_COMMAND, () => {
                return codeMirror.editor?.state.doc.toString();
            });

            codeMirror.registerCommand(SET_NOTE_TEXT_COMMAND, (expectedText: unknown, newText: unknown) => {
                if (typeof expectedText !== 'string' || typeof newText !== 'string') return false;
                const view = codeMirror.editor as EditorViewLike;
                const currentText = view.state.doc.toString();
                if (currentText !== expectedText) return false;
                if (newText === currentText) return false;
                view.dispatch({ changes: computeChanges(currentText, newText) });
                return true;
            });
        },
    };
};
