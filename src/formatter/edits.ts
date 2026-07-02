import type { Edit } from './types';

/**
 * Apply a set of non-overlapping edits to `text`.
 *
 * Edits are validated (in bounds, non-overlapping) before anything is
 * applied; a violation throws so the caller can abort and keep the original
 * text rather than write back a half-applied result.
 */
export function applyEdits(text: string, edits: Edit[]): string {
    if (edits.length === 0) return text;

    const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);

    let result = '';
    let cursor = 0;
    for (const edit of sorted) {
        if (edit.start > edit.end || edit.start < 0 || edit.end > text.length) {
            throw new Error(`Edit out of bounds: [${edit.start}, ${edit.end}) in text of length ${text.length}`);
        }
        if (edit.start < cursor) {
            throw new Error(`Overlapping edits at offset ${edit.start}`);
        }
        result += text.slice(cursor, edit.start) + edit.replacement;
        cursor = edit.end;
    }
    result += text.slice(cursor);
    return result;
}
