import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, lineIndexOfOffset } from '../lines';
import { getProtectedRanges, type OffsetRange } from '../protectedRanges';
import { walkWithAncestors } from '../walk';
import { createEditSink } from './blockSpacing';

/**
 * Number of columns a tab advances to (the next multiple of), matching
 * micromark's `constants.tabSize`. A block quote marker allows up to
 * `TAB_SIZE - 1` columns of indentation before it.
 */
const TAB_SIZE = 4;

/**
 * Normalize the whitespace right after a blockquote's `>` marker(s) to a
 * single space. Only the gap between the last `>` and the line's content is
 * touched; indentation before/between markers is left as written.
 *
 * Three kinds of content make blind collapsing unsafe, so all are left alone:
 * - Literal content (code, HTML, math, front matter) protected by
 *   {@link getProtectedRanges}, which can rely on exact indentation.
 * - Lines inside a list nested in a blockquote, where a continuation line's
 *   indentation determines which list item it belongs to (same exemption
 *   `listIndentation` already makes for lists inside blockquotes).
 * - A line where content right after the marker(s) itself starts with `>`:
 *   the parser only treats that `>` as a further nesting level within a
 *   tight column budget (see {@link matchMarkerPrefix}), so shrinking the
 *   gap in front of it could turn literal quoted text into a new nesting
 *   level on the next parse.
 */
export const blockquoteMarkerSpacing: Rule = {
    name: 'blockquoteMarkerSpacing',

    isEnabled(options) {
        return options.normalizeBlockquoteMarkerSpacing;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const { edits, addEdit } = createEditSink(text);
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const protectedRanges = getProtectedRanges(tree);
        const skipLines = collectListLines(tree, lineStarts);

        walkWithAncestors(tree, (node, ancestors) => {
            if (node.type !== 'blockquote') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return; // process outermost only

            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const firstLine = lineIndexOfOffset(lineStarts, start);
            const lastLine = lineIndexOfOffset(lineStarts, Math.max(start, end - 1));

            for (let line = firstLine; line <= lastLine; line++) {
                if (skipLines.has(line)) continue;
                addLineEdit(text, lineStarts[line], lineEnd(line), protectedRanges, addEdit);
            }
        });

        return edits;
    },
};

/** Line indexes covered by any list nested inside a blockquote, at any depth. */
function collectListLines(tree: RuleContext['tree'], lineStarts: number[]): Set<number> {
    const skipLines = new Set<number>();
    walkWithAncestors(tree, (node, ancestors) => {
        if (node.type !== 'list') return;
        if (!ancestors.some((ancestor) => ancestor.type === 'blockquote')) return;

        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (start === undefined || end === undefined) return;

        const firstLine = lineIndexOfOffset(lineStarts, start);
        const lastLine = lineIndexOfOffset(lineStarts, Math.max(start, end - 1));
        for (let line = firstLine; line <= lastLine; line++) skipLines.add(line);
    });
    return skipLines;
}

/**
 * Find the end of the last `>` marker in a (possibly nested) blockquote
 * prefix, replicating micromark's container matching (see
 * `micromark-core-commonmark/lib/block-quote.js`): each level allows 0 to
 * `TAB_SIZE - 1` columns of leading space/tab (tab-stop aware) before its
 * `>`, then optionally consumes exactly one following space/tab character
 * (not tab-expanded) as that level's own before the next level is attempted.
 * Returns null if the line has no marker at all (a lazy continuation line).
 */
function matchMarkerPrefix(text: string, lineStart: number, lineEnd: number): number | null {
    let pos = lineStart;
    let col = 0;
    let lastMarkerEnd: number | null = null;

    for (;;) {
        const levelStartCol = col;
        let p = pos;
        let c = col;
        while (p < lineEnd) {
            const ch = text[p];
            if (ch !== ' ' && ch !== '\t') break;
            const nextCol = ch === '\t' ? (Math.floor(c / TAB_SIZE) + 1) * TAB_SIZE : c + 1;
            if (nextCol - levelStartCol > TAB_SIZE - 1) break;
            c = nextCol;
            p++;
        }
        if (p >= lineEnd || text[p] !== '>') break;

        p++;
        c++;
        lastMarkerEnd = p;
        pos = p;
        col = c;

        if (pos < lineEnd) {
            const ch = text[pos];
            if (ch === ' ' || ch === '\t') {
                pos++;
                col = ch === '\t' ? (Math.floor(col / TAB_SIZE) + 1) * TAB_SIZE : col + 1;
            }
        }
    }

    return lastMarkerEnd;
}

function addLineEdit(
    text: string,
    lineStart: number,
    lineEndOffset: number,
    protectedRanges: OffsetRange[],
    addEdit: (edit: Edit) => void
): void {
    const markerEnd = matchMarkerPrefix(text, lineStart, lineEndOffset);
    if (markerEnd === null) return; // lazy continuation line, no marker to normalize

    // The marker's position itself sits inside literal content that started
    // on an earlier line (e.g. an interior line of a fenced/indented code
    // block quoted line-by-line) — the whole remainder is protected.
    if (protectedRanges.some((range) => range.start < markerEnd && range.end > markerEnd)) return;

    const wsMatch = /^[ \t]*/.exec(text.slice(markerEnd, lineEndOffset))!;
    const wsEnd = markerEnd + wsMatch[0].length;

    // Cap the editable span at the nearest protected range beginning within
    // it (e.g. the required indentation of an indented code block).
    let cap = wsEnd;
    for (const range of protectedRanges) {
        if (range.start >= markerEnd && range.start < cap) cap = range.start;
    }

    const cappedByProtection = cap < wsEnd;
    if (!cappedByProtection) {
        if (/^\r?\n?$/.test(text.slice(wsEnd, lineEndOffset))) return; // blank quote line; trim rule handles it
        // matchMarkerPrefix deliberately stopped short of this `>` (the gap
        // exceeded the level budget); shrinking the gap could make it a new
        // nesting level on the next parse instead of literal quoted text.
        if (text[wsEnd] === '>') return;
    }

    addEdit({ start: markerEnd, end: cap, replacement: ' ' });
}
