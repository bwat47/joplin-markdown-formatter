import type { Edit, Rule, RuleContext } from '../types';
import { computeLineStarts, lineIndexOfOffset } from '../lines';
import { getProtectedRanges, type OffsetRange } from '../protectedRanges';
import { walkWithAncestors } from '../walk';
import { createEditSink } from './blockSpacing';

/** 0-3 leading spaces, then one or more `>` markers (nested quotes stack them on one line). */
const MARKER_PREFIX = /^(?: {0,3}>)+/;

/**
 * Normalize the whitespace right after a blockquote's `>` marker(s) to a
 * single space. Only the gap between the last `>` and the line's content is
 * touched; indentation before/between markers is left as written.
 *
 * Two kinds of content make blind collapsing unsafe, so both are left alone:
 * - Literal content (code, HTML, math, front matter) protected by
 *   {@link getProtectedRanges}, which can rely on exact indentation.
 * - Lines inside a list nested in a blockquote, where a continuation line's
 *   indentation determines which list item it belongs to (same exemption
 *   `listIndentation` already makes for lists inside blockquotes).
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

function addLineEdit(
    text: string,
    lineStart: number,
    lineEndOffset: number,
    protectedRanges: OffsetRange[],
    addEdit: (edit: Edit) => void
): void {
    const markerMatch = MARKER_PREFIX.exec(text.slice(lineStart, lineEndOffset));
    if (!markerMatch) return; // lazy continuation line, no marker to normalize

    const markerEnd = lineStart + markerMatch[0].length;

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
    const atEndOfLine = !cappedByProtection && /^\r?\n?$/.test(text.slice(wsEnd, lineEndOffset));
    if (atEndOfLine) return; // blank quote line; trimTrailingWhitespace handles it

    addEdit({ start: markerEnd, end: cap, replacement: ' ' });
}
