import type { Edit, Rule, RuleContext } from '../types';

/**
 * Ensure YAML front matter is separated from following Markdown content by
 * exactly one blank line. The YAML block itself remains untouched.
 */
export const frontmatterSpacing: Rule = {
    name: 'frontmatterSpacing',

    isEnabled(options) {
        return options.ensureFrontmatterBlankLine;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const frontmatter = tree.children[0];
        if (frontmatter?.type !== 'yaml') return [];

        const end = frontmatter.position?.end?.offset;
        if (end === undefined) return [];

        const blankRun = text.slice(end).match(/^(?:[ \t]*\r?\n)*/)?.[0] ?? '';
        const nextContent = end + blankRun.length;
        if (nextContent >= text.length) return [];

        const replacement = '\n\n';
        if (blankRun === replacement) return [];

        return [{ start: end, end: nextContent, replacement }];
    },
};
