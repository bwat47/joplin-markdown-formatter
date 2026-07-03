import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure headings have exactly one blank line around them when neighboring
 * content exists. Blockquote headings are left alone because inserting
 * ordinary blank lines there splits the quote into separate blockquotes.
 */
export const headingSpacing = createBlockSpacingRule({
    name: 'headingSpacing',
    option: 'ensureHeadingBlankLines',
    nodeType: 'heading',
});
