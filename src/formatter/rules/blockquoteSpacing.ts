import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure blockquotes have exactly one blank line around them when neighboring
 * content exists. Only the outer boundaries of a quote are touched: interior
 * nesting changes (e.g. `>` jumping to `>>>`) belong to a single blockquote
 * node, and rewriting them would split the quote and change rendering. Quotes
 * nested inside other blockquotes are left alone for the same reason.
 *
 * Per CommonMark, a plain text line directly below a quote is a lazy
 * continuation and still part of the quote. The parsed node includes such
 * lines, so the blank line is inserted after them, never between them and the
 * `>` lines, and rendering never changes.
 */
export const blockquoteSpacing = createBlockSpacingRule({
    name: 'blockquoteSpacing',
    option: 'ensureBlockquoteBlankLines',
    nodeType: 'blockquote',
});
