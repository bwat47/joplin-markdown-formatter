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
    let pos = lineStart;
    let col = 0;

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

        const markerStart = p;
        p++;
        c++;
        markers.push({ start: markerStart, end: p });
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

    // Between two markers is always pure structural whitespace (content can
    // never start there), and any gap the matcher accepted is within the
    // per-level budget, so shrinking it to one space never changes what the
    // next parse recognizes.
    for (let i = 0; i < markers.length - 1; i++) {
        addEdit({ start: markers[i].end, end: markers[i + 1].start, replacement: ' ' });
    }

    const markerEnd = markers[markers.length - 1].end;

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
