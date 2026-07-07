import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level paragraphs have exactly one blank line around them when
 * neighboring content exists. Paragraphs inside lists are left to listSpacing
 * because inserting blank lines there can change tight/loose rendering.
 */
export const paragraphSpacing = createBlockSpacingRule({
    name: 'paragraphSpacing',
    option: 'ensureParagraphBlankLines',
    nodeType: 'paragraph',
    shouldSpace(_node, ancestors) {
        return ancestors.length === 1 && ancestors[0].type === 'root';
    },
});
