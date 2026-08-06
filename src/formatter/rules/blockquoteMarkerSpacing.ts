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
 * Normalize the whitespace around a blockquote's `>` marker(s) to a single
 * space: between consecutive markers of a nested quote, and between the
 * last marker and the quoted content. Indentation before the first marker
 * is left as written.
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
                addLineEdits(text, lineStarts[line], lineEnd(line), protectedRanges, addEdit);
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

/** Half-open [start, end) span of one `>` character in a marker chain. */
interface MarkerSpan {
    start: number;
    end: number;
}

/** A position within a line, paired with the column it renders at. */
interface Cursor {
    pos: number;
    col: number;
}

/** Column reached after `ch` at column `col`, advancing tabs to the next tab stop. */
function advanceColumn(ch: string, col: number): number {
    return ch === '\t' ? (Math.floor(col / TAB_SIZE) + 1) * TAB_SIZE : col + 1;
}

/**
 * Skip the 0 to `TAB_SIZE - 1` columns of space/tab indentation a block quote
 * level may have before its `>`. Stops before the character that would exceed
 * that budget, so the caller sees a non-`>` and ends the marker chain.
 */
function skipLevelIndent(text: string, cursor: Cursor, lineEnd: number): Cursor {
    const startCol = cursor.col;
    let { pos, col } = cursor;

    while (pos < lineEnd) {
        const ch = text[pos];
        if (ch !== ' ' && ch !== '\t') break;
        const nextCol = advanceColumn(ch, col);
        if (nextCol - startCol > TAB_SIZE - 1) break;
        col = nextCol;
        pos++;
    }

    return { pos, col };
}

/**
 * Consume the one space/tab a level optionally claims as its own after the
 * `>`. Exactly one character, regardless of how many columns a tab spans.
 */
function consumeMarkerSpace(text: string, cursor: Cursor, lineEnd: number): Cursor {
    if (cursor.pos >= lineEnd) return cursor;
    const ch = text[cursor.pos];
    if (ch !== ' ' && ch !== '\t') return cursor;
    return { pos: cursor.pos + 1, col: advanceColumn(ch, cursor.col) };
}

/**
 * Find every `>` marker in a (possibly nested) blockquote prefix, replicating
 * micromark's container matching (see
 * `micromark-core-commonmark/lib/block-quote.js`): each level allows 0 to
 * `TAB_SIZE - 1` columns of leading space/tab (tab-stop aware) before its
 * `>`, then optionally consumes exactly one following space/tab character
 * (not tab-expanded) as that level's own before the next level is attempted.
 * Returns an empty array for a line with no marker at all (a lazy
 * continuation line).
 */
function matchMarkerPrefix(text: string, lineStart: number, lineEnd: number): MarkerSpan[] {
    const markers: MarkerSpan[] = [];
    let cursor: Cursor = { pos: lineStart, col: 0 };

    for (;;) {
        const afterIndent = skipLevelIndent(text, cursor, lineEnd);
        if (afterIndent.pos >= lineEnd || text[afterIndent.pos] !== '>') break;

        const markerStart = afterIndent.pos;
        cursor = { pos: markerStart + 1, col: afterIndent.col + 1 };
        markers.push({ start: markerStart, end: cursor.pos });
        cursor = consumeMarkerSpace(text, cursor, lineEnd);
    }

    return markers;
}

function addLineEdits(
    text: string,
    lineStart: number,
    lineEndOffset: number,
    protectedRanges: OffsetRange[],
    addEdit: (edit: Edit) => void
): void {
    const markers = matchMarkerPrefix(text, lineStart, lineEndOffset);
    if (markers.length === 0) return; // lazy continuation line, no marker to normalize

    const markerEnd = markers[markers.length - 1].end;

    // The marker's position itself sits inside literal content that started
    // on an earlier line (e.g. an interior line of a fenced/indented code
    // block quoted line-by-line) — the whole prefix and remainder are
    // protected, including any `>` characters that resemble nested markers.
    if (protectedRanges.some((range) => range.start < markerEnd && range.end > markerEnd)) return;

    // Between two structural markers is always pure whitespace, and any gap
    // the matcher accepted is within the per-level budget, so shrinking it to
    // one space never changes what the next parse recognizes.
    for (let i = 0; i < markers.length - 1; i++) {
        addEdit({ start: markers[i].end, end: markers[i + 1].start, replacement: ' ' });
    }

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
