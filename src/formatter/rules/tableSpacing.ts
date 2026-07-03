import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure tables have exactly one blank line around them when neighboring
 * content exists. Blockquote tables are left alone because ordinary blank
 * lines split the quote.
 *
 * Per GFM, a pipeless text line directly below a table is still a table row
 * (only a blank line or a new block construct ends the table), and the parsed
 * table node includes such lines. The blank line is therefore inserted after
 * them, never between them and the pipe rows, so rendering never changes.
 */
export const tableSpacing = createBlockSpacingRule({
    name: 'tableSpacing',
    option: 'ensureTableBlankLines',
    nodeType: 'table',
});
