import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure code blocks have exactly one blank line around them when neighboring
 * content exists. Blockquote code blocks are left alone because ordinary blank
 * lines split the quote.
 */
export const codeBlockSpacing = createBlockSpacingRule({
    name: 'codeBlockSpacing',
    option: 'ensureCodeBlockBlankLines',
    nodeType: 'code',
});
