import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level math blocks have exactly one blank line around them when
 * neighboring content exists. Math blocks inside lists and blockquotes are
 * left to listSpacing and to the author, because a blank line there changes
 * rendering rather than just layout.
 */
export const mathBlockSpacing = createBlockSpacingRule({
    name: 'mathBlockSpacing',
    option: 'ensureMathBlockBlankLines',
    nodeType: 'math',
});
