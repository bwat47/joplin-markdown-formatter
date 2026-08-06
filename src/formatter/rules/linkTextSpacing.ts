import type { Link, LinkReference } from 'mdast';
import type { Node, Parent } from 'unist';
import type { Edit, Rule, RuleContext } from '../types';
import { walk, walkWithAncestors } from '../walk';

/** A half-open source range `[start, end)`. */
interface Span {
    start: number;
    end: number;
}

/** Matches any line ending, including the `\r` half of a CRLF pair. */
const LINE_BREAK = /[\r\n]/;

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
 * Source ranges inside `region` this rule may rewrite — every descendant `text`
 * and `break` node, plus whitespace runs that belong to no node at all — merged
 * into maximal runs so each run is normalized as one piece, and the `break`
 * spans among them.
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
 */
function editableRuns(link: Link | LinkReference, text: string, region: Span): { runs: Span[]; breaks: Span[] } {
    const spans: Span[] = [];
    const breaks: Span[] = [];
    const covered = new Array<boolean>(region.end - region.start).fill(false);
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
            // A hard break is whitespace like any other here: it collapses to a
            // single space, which also frees the indentation that follows it to
            // merge into the same run.
            spans.push({ start, end });
            breaks.push({ start, end });
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

    let index = 0;
    while (index < covered.length) {
        if (covered[index]) {
            index += 1;
            continue;
        }
        let gapEnd = index;
        while (gapEnd < covered.length && !covered[gapEnd]) gapEnd += 1;
        const gap = { start: region.start + index, end: region.start + gapEnd };
        index = gapEnd;

        if (/^\s+$/.test(text.slice(gap.start, gap.end))) spans.push(gap);
    }

    return { runs: mergeSpans(spans), breaks };
}

/**
 * Collapse a run to single spaces, with each hard break inside it standing in
 * for one space.
 *
 * Breaks are substituted by offset rather than by pattern because the two forms
 * a `break` node can take are not both whitespace, and one of them is not even
 * distinguishable in the raw text: `a\` + newline is a hard break, while `a\\` +
 * newline is an escaped backslash followed by a *soft* break. Only the tree
 * tells them apart, so a regex over the source would eat the wrong backslash.
 */
function collapseRun(run: Span, text: string, breaks: Span[]): string {
    let result = '';
    let cursor = run.start;
    for (const hardBreak of breaks) {
        if (hardBreak.start < cursor || hardBreak.end > run.end) continue;
        result += text.slice(cursor, hardBreak.start) + ' ';
        cursor = hardBreak.end;
    }
    return (result + text.slice(cursor, run.end)).replace(/\s+/g, ' ');
}

/**
 * Inside a blockquote, a line break in the link text means the next line opens
 * with a `>` marker that sits inside the region but is not part of the label;
 * collapsing the run would drag it into the text. Leave that one link alone
 * rather than let the whole rule fail verification and be dropped for the
 * entire note.
 */
function isMultiLineInBlockquote(text: string, region: Span, ancestors: Node[]): boolean {
    return (
        LINE_BREAK.test(text.slice(region.start, region.end)) &&
        ancestors.some((ancestor) => ancestor.type === 'blockquote')
    );
}

/** Edits that normalize the whitespace runs inside one link's text region. */
function linkTextEdits(link: Link | LinkReference, text: string, region: Span, collapseLineBreaks: boolean): Edit[] {
    const edits: Edit[] = [];
    const { runs, breaks } = editableRuns(link, text, region);
    for (const run of runs) {
        const source = text.slice(run.start, run.end);
        if (!collapseLineBreaks && LINE_BREAK.test(source)) continue;
        let normalized = collapseRun(run, text, breaks);
        if (run.start === region.start) normalized = normalized.trimStart();
        if (run.end === region.end) normalized = normalized.trimEnd();
        if (normalized !== source) edits.push({ start: run.start, end: run.end, replacement: normalized });
    }
    return edits;
}

/** Merge touching or overlapping spans, in source order, so no two edits collide. */
function mergeSpans(spans: Span[]): Span[] {
    const merged: Span[] = [];
    for (const span of [...spans].sort((a, b) => a.start - b.start || a.end - b.end)) {
        const last = merged[merged.length - 1];
        if (last && span.start <= last.end) last.end = Math.max(last.end, span.end);
        else merged.push({ ...span });
    }
    return merged;
}

/**
 * Normalize whitespace inside link text: collapse runs of whitespace to a single
 * space and trim leading/trailing whitespace right inside the brackets. So
 * `[ a link ](url)` -> `[a link](url)` and `[a     link](url)` -> `[a link](url)`.
 *
 * The `all` mode (default) also treats line breaks as collapsible whitespace, so
 * a newline in the text becomes a space (or is dropped if it is only trailing)
 * and the label ends up on one line. The `spaces` mode leaves any run that
 * contains a line break entirely alone — including the whitespace bordering it,
 * which is part of the same run — so multi-line labels stay as written.
 *
 * All descendant `text` nodes are edited, including text inside emphasis and
 * other inline formatting. Nodes such as `inlineCode` and `math` store their
 * content as properties rather than text children, so their whitespace passes
 * through untouched. Single spaces that separate inline nodes mid-text (e.g.
 * `[a *b* c]`) survive because boundary trimming only applies where the text
 * touches a bracket.
 *
 * Under `all`, hard line breaks collapse to a single space like any other line
 * break, in both the two-space and backslash forms. They render as a `<br>`
 * inside the anchor, which Joplin's editor displays as a broken-looking link,
 * and a one-line label is what the rest of this rule normalizes toward. Dropping
 * the `break` node is a structural change, so `verify.ts` grants this rule a
 * matching exemption.
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
        return options.linkTextSpacing !== 'preserve';
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        const collapseLineBreaks = options.linkTextSpacing === 'all';

        walkWithAncestors(tree, (node, ancestors) => {
            if (node.type !== 'link' && node.type !== 'linkReference') return;
            const link = node as Link | LinkReference;
            if (link.children.length === 0) return;
            const region = linkTextRegion(link, text);
            if (!region) return;
            if (isMultiLineInBlockquote(text, region, ancestors)) return;

            edits.push(...linkTextEdits(link, text, region, collapseLineBreaks));
        });

        return edits;
    },
};
