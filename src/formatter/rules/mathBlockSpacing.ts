import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure math blocks have exactly one blank line around them when neighboring
 * content exists. Blockquote math blocks are left alone because ordinary blank
 * lines split the quote.
 */
export const mathBlockSpacing = createBlockSpacingRule({
    name: 'mathBlockSpacing',
    option: 'ensureMathBlockBlankLines',
    nodeType: 'math',
});
