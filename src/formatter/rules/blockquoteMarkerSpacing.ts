import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, lineIndexOfOffset } from '../lines';
import { getProtectedRanges, type OffsetRange } from '../protectedRanges';
import { walkWithAncestors } from '../walk';
import { createEditSink } from './blockSpacing';

/**
 * Normalize the whitespace around a blockquote's `>` marker(s) to a single
 * space: between consecutive markers of a nested quote, and between the
 * last marker and the quoted content. Indentation before the first marker
 * is left as written.
 *
 * Normalization is all-or-nothing per outermost blockquote: if any of its
 * lines cannot be touched, the entire quote is left as written. Rewriting
 * only the touchable lines would leave one quote with two marker styles
 * (`> > ` on the line opening a fenced code block, `>>` on the fenced lines
 * below it), which is worse than leaving the quote alone.
 *
 * A line cannot be touched when:
 * - Its marker prefix sits inside literal content (code, HTML, math, front
 *   matter) protected by {@link getProtectedRanges}, which can rely on exact
 *   indentation — the interior and closing lines of a fenced code block
 *   quoted line by line, for instance.
 * - It belongs to a list nested in the blockquote, where a continuation
 *   line's indentation determines which list item it belongs to (same
 *   exemption `listIndentation` already makes for lists inside blockquotes).
 *
 * One case is left alone line by line rather than quote-wide: content right
 * after the marker(s) that itself starts with `>`. The parser only treats
 * that `>` as a further nesting level within a tight column budget (up to
 * three columns of indentation after the previous level's optional space), so
 * shrinking the gap in front of it could turn literal quoted text into a new
 * nesting level on the next parse.
 *
 * Marker positions come from the parser itself (see `parseMarkdown`),
 * so tab stops and nesting budgets never have to be re-derived here.
 */
export const blockquoteMarkerSpacing: Rule = {
    name: 'blockquoteMarkerSpacing',

    isEnabled(options) {
        return options.normalizeBlockquoteMarkerSpacing;
    },

    apply({ text, tree, blockquoteMarkers }: RuleContext): Edit[] {
        const { edits, addEdit } = createEditSink(text);
        const lineStarts = computeLineStarts(text);
        const lineEnd = (i: number): number => lineStarts[i + 1] ?? text.length;
        const protectedRanges = getProtectedRanges(tree);
        const listLines = collectListLines(tree, lineStarts);
        const markersByLine = groupMarkersByLine(blockquoteMarkers, lineStarts);

        walkWithAncestors(tree, (node, ancestors) => {
            if (node.type !== 'blockquote') return;
            if (ancestors.some((ancestor) => ancestor.type === 'blockquote')) return; // process outermost only

            const start = node.position?.start?.offset;
            const end = node.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            const firstLine = lineIndexOfOffset(lineStarts, start);
            const lastLine = lineIndexOfOffset(lineStarts, Math.max(start, end - 1));

            const quoteEdits: Edit[] = [];
            for (let line = firstLine; line <= lastLine; line++) {
                if (listLines.has(line)) return; // untouchable line: leave the whole quote as written
                const markers = markersByLine.get(line) ?? [];
                const lineEdits = collectLineEdits(text, markers, lineEnd(line), protectedRanges);
                if (lineEdits === null) return;
                quoteEdits.push(...lineEdits);
            }

            for (const edit of quoteEdits) addEdit(edit);
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
 * The parser's blockquote markers grouped by the line they sit on, outermost
 * first. A line with no entry has no marker at all (a lazy continuation line).
 */
function groupMarkersByLine(markers: OffsetRange[], lineStarts: number[]): Map<number, OffsetRange[]> {
    const byLine = new Map<number, OffsetRange[]>();
    for (const marker of markers) {
        const line = lineIndexOfOffset(lineStarts, marker.start);
        const lineMarkers = byLine.get(line);
        if (lineMarkers) lineMarkers.push(marker);
        else byLine.set(line, [marker]);
    }
    return byLine;
}

/**
 * Edits normalizing one line's marker prefix, or `null` when the line's
 * markers sit inside protected literal content and cannot be rewritten — in
 * which case the caller leaves the whole blockquote alone.
 */
function collectLineEdits(
    text: string,
    markers: OffsetRange[],
    lineEndOffset: number,
    protectedRanges: OffsetRange[]
): Edit[] | null {
    if (markers.length === 0) return []; // lazy continuation line, no marker to normalize

    const markerEnd = markers[markers.length - 1].end;

    // The marker's position itself sits inside literal content that started
    // on an earlier line (e.g. an interior line of a fenced/indented code
    // block quoted line-by-line) — the whole prefix and remainder are
    // protected, including any `>` characters that resemble nested markers.
    if (protectedRanges.some((range) => range.start < markerEnd && range.end > markerEnd)) return null;

    const edits: Edit[] = [];

    // Between two structural markers is always pure whitespace, and any gap
    // the parser accepted is within the per-level budget, so shrinking it to
    // one space never changes what the next parse recognizes.
    for (let i = 0; i < markers.length - 1; i++) {
        edits.push({ start: markers[i].end, end: markers[i + 1].start, replacement: ' ' });
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
        if (/^\r?\n?$/.test(text.slice(wsEnd, lineEndOffset))) return edits; // blank quote line; trim rule handles it
        // The parser did not match this `>` as a marker (the gap exceeded the
        // level budget); shrinking the gap could make it a new nesting level
        // on the next parse instead of literal quoted text.
        if (text[wsEnd] === '>') return edits;
    }

    edits.push({ start: markerEnd, end: cap, replacement: ' ' });
    return edits;
}
