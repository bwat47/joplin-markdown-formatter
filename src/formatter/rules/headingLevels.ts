import type { Heading } from 'mdast';
import type { Edit, MinimumHeadingLevel, Rule, RuleContext } from '../types';
import { walk } from '../walk';

const MAX_DEPTH = 6;

/**
 * Lower heading levels that skip over intermediate levels, e.g. `#` followed
 * by `####` becomes `#` followed by `##`. Decreases are left alone.
 *
 * `minimumHeadingLevel` sets the shallowest level the document may use:
 * `none` (default) keeps the first heading's authored level and lets later
 * headings go as shallow as they like; `firstHeading` floors every heading at
 * the first heading's level; `h2` shifts every heading by the same amount so
 * the first one lands on level 2, preserving the note's relative hierarchy.
 */
export const headingLevels: Rule = {
    name: 'headingLevels',

    isEnabled(options) {
        return options.normalizeHeadingLevels;
    },

    apply({ text, tree, options }: RuleContext): Edit[] {
        const headings: Heading[] = [];
        walk(tree, (node) => {
            if (node.type === 'heading') headings.push(node as Heading);
        });
        if (headings.length === 0) return [];

        const { baseline, shift } = baselineFor(options.minimumHeadingLevel, headings[0].depth);
        const edits: Edit[] = [];
        let previousDepth: number | undefined;

        for (const heading of headings) {
            const shifted = clamp(heading.depth + shift, baseline, MAX_DEPTH);
            // The increment cap is floored again: a heading the rule could not
            // rewrite (see below) leaves `previousDepth` under `baseline`, and
            // capping against it would push this heading under the floor too.
            const desiredDepth =
                previousDepth === undefined ? shifted : Math.max(Math.min(shifted, previousDepth + 1), baseline);

            // A heading we cannot rewrite (setext, or missing offsets) keeps its
            // authored level in the text, so the ones after it must normalize
            // against that level rather than the one we wanted.
            const changed = desiredDepth !== heading.depth && addAtxHeadingEdits(text, heading, desiredDepth, edits);
            previousDepth = changed || desiredDepth === heading.depth ? desiredDepth : heading.depth;
        }

        return edits;
    },
};

/**
 * The shallowest level the document may use, plus the amount every heading
 * moves to get there. Only `h2` shifts; the other modes just set a floor.
 */
function baselineFor(minimum: MinimumHeadingLevel, firstDepth: number): { baseline: number; shift: number } {
    switch (minimum) {
        case 'h2':
            return { baseline: 2, shift: 2 - firstDepth };
        case 'firstHeading':
            return { baseline: firstDepth, shift: 0 };
        default:
            return { baseline: 1, shift: 0 };
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/** Returns whether the heading's markers could be rewritten to `desiredDepth`. */
function addAtxHeadingEdits(text: string, heading: Heading, desiredDepth: number, edits: Edit[]): boolean {
    const start = heading.position?.start?.offset;
    const end = heading.position?.end?.offset;
    if (start === undefined || end === undefined) return false;

    const source = text.slice(start, end);
    const opening = /^(#{1,6})(?=[\t ]|$)/.exec(source);
    if (!opening) return false;

    const marker = '#'.repeat(desiredDepth);
    edits.push({ start, end: start + opening[1].length, replacement: marker });

    // Only the last whitespace character before the closing sequence is matched:
    // `[\t ]+` here would backtrack quadratically over a long whitespace run.
    const closing = /[\t ](#+)[\t ]*$/.exec(source);
    if (!closing) return true;

    const closingStart = start + closing.index + 1;
    edits.push({ start: closingStart, end: closingStart + closing[1].length, replacement: marker });
    return true;
}
