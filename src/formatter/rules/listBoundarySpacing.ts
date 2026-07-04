import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure root-level lists have exactly one blank line around them when
 * neighboring content exists. Nested lists are left to listSpacing because
 * inserting blank lines inside list items can change tight/loose rendering.
 */
export const listBoundarySpacing = createBlockSpacingRule({
    name: 'listBoundarySpacing',
    option: 'ensureListBlankLines',
    nodeType: 'list',
    shouldSpace(_node, ancestors) {
        return ancestors.length === 1 && ancestors[0].type === 'root';
    },
});
