import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level headings have exactly one blank line around them when
 * neighboring content exists. Headings inside lists and blockquotes are left
 * to listSpacing and to the author, because a blank line there changes
 * rendering rather than just layout.
 */
export const headingSpacing = createBlockSpacingRule({
    name: 'headingSpacing',
    option: 'ensureHeadingBlankLines',
    nodeType: 'heading',
});
