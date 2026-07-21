import type { Link, LinkReference } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

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
 * `[a *b* c]`) survive because boundary trimming only applies to a direct
 * first/last text child.
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
            const children = (node as Link | LinkReference).children;
            if (children.length === 0) return;

            children.forEach((child, index) => {
                walk(child, (descendant) => {
                    if (descendant.type !== 'text') return;
                    const start = descendant.position?.start?.offset;
                    const end = descendant.position?.end?.offset;
                    if (start === undefined || end === undefined) return;

                    const source = text.slice(start, end);
                    let normalized = source.replace(/\s+/g, ' ');
                    if (descendant === child && index === 0) normalized = normalized.trimStart();
                    if (descendant === child && index === children.length - 1) normalized = normalized.trimEnd();
                    if (normalized !== source) edits.push({ start, end, replacement: normalized });
                });
            });
        });

        return edits;
    },
};
