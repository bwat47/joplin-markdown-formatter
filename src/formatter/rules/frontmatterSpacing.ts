import { createBlockSpacingRule } from './blockSpacing';

/**
 * Ensure YAML front matter is separated from following Markdown content by
 * exactly one blank line. The YAML block itself remains untouched.
 */
export const frontmatterSpacing = createBlockSpacingRule({
    name: 'frontmatterSpacing',
    option: 'ensureFrontmatterBlankLine',
    nodeType: 'yaml',
});
