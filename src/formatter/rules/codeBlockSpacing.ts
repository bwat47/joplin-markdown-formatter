import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level code blocks have exactly one blank line around them when
 * neighboring content exists. Code blocks inside lists and blockquotes are
 * left to listSpacing and to the author, because a blank line there changes
 * rendering rather than just layout.
 */
export const codeBlockSpacing = createBlockSpacingRule({
    name: 'codeBlockSpacing',
    option: 'ensureCodeBlockBlankLines',
    nodeType: 'code',
});
