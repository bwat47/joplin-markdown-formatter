import type { Link, LinkReference } from 'mdast';
import type { Node, Parent } from 'unist';
import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/** A half-open source range `[start, end)`. */
interface Span {
    start: number;
    end: number;
}

/**
 * Source range between a link's brackets: just after `[` up to the `]` that
 * closes the text. The closing bracket is found by scanning forward from the
 * last child rather than trusting that child's end, because whitespace right
 * before `]` can belong to no node at all (see {@link editableSpans}).
 */
function linkTextRegion(link: Link | LinkReference, text: string): Span | null {
    const linkStart = link.position?.start?.offset;
    const linkEnd = link.position?.end?.offset;
    const lastChildEnd = link.children[link.children.length - 1]?.position?.end?.offset;
    if (linkStart === undefined || linkEnd === undefined || lastChildEnd === undefined) return null;
    if (text[linkStart] !== '[') return null;

    let close = lastChildEnd;
    while (close < linkEnd && /\s/.test(text[close])) close += 1;
    const end = text[close] === ']' ? close : lastChildEnd;
    return end > linkStart + 1 ? { start: linkStart + 1, end } : null;
}

/**
 * Source ranges inside `region` this rule may rewrite: every descendant `text`
 * node, plus whitespace runs that belong to no node at all, merged into
 * maximal runs so each run is normalized as one piece.
 *
 * The gaps matter because CommonMark strips the whitespace around a soft line
 * ending, and mdast positions follow: in `[a **b** \nc](url)` the space before
 * the newline sits between the `strong` node and the following `text` node,
 * inside neither. Editing only the text nodes left that space behind next to
 * the space the newline collapsed to (`[a **b**  c]`), which took a second
 * format run to clean up.
 *
 * A gap can open between the children of any inline container, not just between
 * the link's own children (`[**a *b* \nc**](url)`), so a container marks only
 * its delimiters as covered and lets its children cover the rest — otherwise its
 * span would hide the gaps nested inside it.
 *
 * Gaps touching a `break` node are skipped: hard line breaks inside link text
 * (and the continuation indent that follows them) are preserved as written.
 */
function editableSpans(link: Link | LinkReference, text: string, region: Span): Span[] {
    const spans: Span[] = [];
    const covered = new Array<boolean>(region.end - region.start).fill(false);
    const breakEdges = new Set<number>();
    const cover = (from: number, to: number) => {
        for (let offset = Math.max(from, region.start); offset < Math.min(to, region.end); offset += 1) {
            covered[offset - region.start] = true;
        }
    };

    walk(link, (node) => {
        if (node === (link as Node)) return;
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        if (start === undefined || end === undefined) return;

        if (node.type === 'text') spans.push({ start, end });
        else if (node.type === 'break') {
            breakEdges.add(start);
            breakEdges.add(end);
        }

        // A container (emphasis, strong, delete, ...) covers only the delimiters
        // around its children; the children themselves are visited in turn, so
        // whatever they leave uncovered between them stays a gap. Leaves — and
        // any node whose children lack positions — cover their whole span.
        const children = (node as Parent).children;
        const childrenStart = children?.[0]?.position?.start?.offset;
        const childrenEnd = children?.[children.length - 1]?.position?.end?.offset;
        if (childrenStart === undefined || childrenEnd === undefined) {
            cover(start, end);
        } else {
            cover(start, childrenStart);
            cover(childrenEnd, end);
        }
    });

    for (let index = 0; index < covered.length; index += 1) {
        if (covered[index]) continue;
        let gapEnd = index;
        while (gapEnd < covered.length && !covered[gapEnd]) gapEnd += 1;
        const gap = { start: region.start + index, end: region.start + gapEnd };
        index = gapEnd - 1;

        if (!/^\s+$/.test(text.slice(gap.start, gap.end))) continue;
        if (breakEdges.has(gap.start) || breakEdges.has(gap.end)) continue;
        spans.push(gap);
    }

    return mergeSpans(spans);
}

/** Merge touching or overlapping spans so no two edits can collide. */
function mergeSpans(spans: Span[]): Span[] {
    const merged: Span[] = [];
    for (const span of [...spans].sort((a, b) => a.start - b.start)) {
        const last = merged[merged.length - 1];
        if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
        else merged.push({ ...span });
    }
    return merged;
}

/**
 * Normalize whitespace inside link text: collapse runs of whitespace (including
 * newlines) to a single space and trim leading/trailing whitespace right inside
 * the brackets. So `[ a link ](url)` -> `[a link](url)`, `[a     link](url)` ->
 * `[a link](url)`, and a soft newline in the text becomes a space (or is dropped
 * if it is only trailing).
 *
 * All descendant `text` nodes are edited, including text inside emphasis and
 * other inline formatting. Nodes such as `inlineCode` and `math` store their
 * content as properties rather than text children, so their whitespace passes
 * through untouched. Single spaces that separate inline nodes mid-text (e.g.
 * `[a *b* c]`) survive because boundary trimming only applies where the text
 * touches a bracket.
 *
 * Reference links are covered too. CommonMark normalizes reference *identifiers*
 * by collapsing/trimming/lowercasing their whitespace — exactly what this rule
 * does to the visible label — so `[ Foo ]` and `[Foo]` still resolve to the same
 * definition. Only the cosmetic label text changes; resolution is preserved.
 *
 * Image alt text is not touched: mdast stores it as a string property, not as
 * editable `text` nodes.
 */
export const linkTextSpacing: Rule = {
    name: 'linkTextSpacing',

    isEnabled(options) {
        return options.normalizeLinkTextSpacing;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];

        walk(tree, (node) => {
            if (node.type !== 'link' && node.type !== 'linkReference') return;
            const link = node as Link | LinkReference;
            if (link.children.length === 0) return;
            const region = linkTextRegion(link, text);
            if (!region) return;

            for (const span of editableSpans(link, text, region)) {
                const source = text.slice(span.start, span.end);
                let normalized = source.replace(/\s+/g, ' ');
                if (span.start === region.start) normalized = normalized.trimStart();
                if (span.end === region.end) normalized = normalized.trimEnd();
                if (normalized !== source) edits.push({ start: span.start, end: span.end, replacement: normalized });
            }
        });

        return edits;
    },
};
