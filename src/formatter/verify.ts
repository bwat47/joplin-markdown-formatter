/**
 * Structural safety check: after a rule rewrites the text, the document must
 * still *mean* the same thing. Trees are compared after normalizing away the
 * differences rules are allowed to make; anything else indicates a rule bug,
 * and the pipeline drops that rule's edits instead of writing them back.
 */

import type { Root } from 'mdast';

interface AnyNode {
    type: string;
    children?: AnyNode[];
    [key: string]: unknown;
}

export function isStructurallyEqual(before: Root, after: Root, ruleName?: string): boolean {
    return (
        JSON.stringify(normalizeNode(before as unknown as AnyNode, ruleName)) ===
        JSON.stringify(normalizeNode(after as unknown as AnyNode, ruleName))
    );
}

function normalizeNode(node: AnyNode, ruleName?: string): AnyNode {
    const copy: AnyNode = { ...node };
    delete copy.position;
    // listSpacing legitimately changes tight/loose.
    if (copy.type === 'list' || copy.type === 'listItem') delete copy.spread;
    // headingLevels legitimately changes heading depth without changing heading text.
    if (copy.type === 'heading') delete copy.depth;
    // codeBlockLanguage legitimately fills in missing fence info strings.
    if (ruleName === 'codeBlockLanguage' && copy.type === 'code') delete copy.lang;
    // quoteStyle legitimately converts quote characters in prose text.
    if (copy.type === 'text' && typeof copy.value === 'string') {
        copy.value = copy.value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    }
    if (Array.isArray(copy.children)) {
        copy.children = mergeAdjacentBulletLists(copy.children.map((child) => normalizeNode(child, ruleName)));
    }
    return copy;
}

/**
 * Adjacent bullet lists differing only by marker merge into one list when
 * listMarkers normalizes the markers — an intended change.
 */
function mergeAdjacentBulletLists(children: AnyNode[]): AnyNode[] {
    const result: AnyNode[] = [];
    for (const child of children) {
        const previous = result[result.length - 1];
        if (
            previous !== undefined &&
            previous.type === 'list' &&
            child.type === 'list' &&
            previous.ordered === false &&
            child.ordered === false
        ) {
            previous.children = [...(previous.children ?? []), ...(child.children ?? [])];
        } else {
            result.push(child);
        }
    }
    return result;
}
