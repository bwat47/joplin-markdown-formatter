import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level tables have exactly one blank line around them when
 * neighboring content exists. Tables inside lists and blockquotes are left to
 * listSpacing and to the author, because a blank line there changes rendering
 * rather than just layout.
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
