import type { Heading } from 'mdast';
import type { Edit, Rule, RuleContext } from '../types';
import { walk } from '../walk';

/**
 * Lower heading levels that skip over intermediate levels, e.g. `#` followed
 * by `####` becomes `#` followed by `##`. The first heading keeps its authored
 * level, and decreases are left alone.
 */
export const headingLevels: Rule = {
    name: 'headingLevels',

    isEnabled(options) {
        return options.normalizeHeadingLevels;
    },

    apply({ text, tree }: RuleContext): Edit[] {
        const edits: Edit[] = [];
        let previousDepth: number | undefined;

        walk(tree, (node) => {
            if (node.type !== 'heading') return;
            const heading = node as Heading;
            const desiredDepth =
                previousDepth === undefined ? heading.depth : Math.min(heading.depth, previousDepth + 1);
            previousDepth = desiredDepth;
            if (desiredDepth === heading.depth) return;

            const start = heading.position?.start?.offset;
            const end = heading.position?.end?.offset;
            if (start === undefined || end === undefined) return;

            addAtxHeadingEdits(text, start, end, desiredDepth, edits);
        });

        return edits;
    },
};

function addAtxHeadingEdits(text: string, start: number, end: number, desiredDepth: number, edits: Edit[]): void {
    const source = text.slice(start, end);
    const opening = /^(#{1,6})(?=[\t ]|$)/.exec(source);
    if (!opening) return;

    const marker = '#'.repeat(desiredDepth);
    edits.push({ start, end: start + opening[1].length, replacement: marker });

    const closing = /[\t ]+(#{1,})[\t ]*$/.exec(source);
    if (!closing) return;

    const closingStart = start + closing.index + closing[0].indexOf(closing[1]);
    edits.push({ start: closingStart, end: closingStart + closing[1].length, replacement: marker });
}
