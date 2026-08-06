/**
 * Structural safety check: after a rule rewrites the text, the document must
 * still *mean* the same thing. Trees are compared after normalizing away the
 * differences rules are allowed to make; anything else indicates a rule bug,
 * and the pipeline drops that rule's edits instead of writing them back.
 *
 * Each exemption is scoped to the rule that owns it via `ruleName`, so a buggy
 * rule cannot ride on another rule's allowance — changing heading depth, say,
 * only passes for headingLevels. The one exception is list tight/loose, which
 * no single rule owns; see the note below.
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

function normalizeNode(node: AnyNode, ruleName?: string, insideLink = false): AnyNode {
    const copy: AnyNode = { ...node };
    delete copy.position;
    dropExemptFields(copy, ruleName);
    normalizeTextValue(copy, ruleName, insideLink);
    if (Array.isArray(copy.children)) {
        copy.children = normalizeChildren(copy.children, copy.type, ruleName, insideLink);
    }
    return copy;
}

/** Drop the fields a rule is allowed to change, so both sides compare equal. */
function dropExemptFields(copy: AnyNode, ruleName?: string): void {
    // Tight/loose is derived from blank lines rather than owned by one rule: any
    // rule that moves a blank line near a list boundary changes it legitimately
    // (e.g. headingIndentation unindenting a heading inside a list item). So this
    // exemption stays global — scoping it to listSpacing would drop the edits of
    // every other spacing rule that touches a list.
    if (copy.type === 'list' || copy.type === 'listItem') delete copy.spread;
    // headingLevels legitimately changes heading depth without changing heading text.
    if (ruleName === 'headingLevels' && copy.type === 'heading') delete copy.depth;
    // codeBlockLanguage legitimately fills in missing fence info strings.
    if (ruleName === 'codeBlockLanguage' && copy.type === 'code') delete copy.lang;
    // linkTextSpacing legitimately collapses/trims whitespace inside link text,
    // including hard breaks (see collapseHardBreaks). The change only touches
    // whitespace within link/linkReference nodes, so we normalize the same way on
    // both sides. A reference link's raw `label` differs after editing while its
    // `identifier` (which governs resolution) is unchanged, so drop the cosmetic
    // label from the comparison.
    if (ruleName === 'linkTextSpacing' && copy.type === 'linkReference') delete copy.label;
}

/** Normalize the text differences a rule is allowed to introduce, in place. */
function normalizeTextValue(copy: AnyNode, ruleName: string | undefined, insideLink: boolean): void {
    if (copy.type !== 'text' || typeof copy.value !== 'string') return;
    // quoteStyle legitimately converts quote characters in prose text.
    let value = ruleName === 'quoteStyle' ? copy.value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'") : copy.value;
    if (ruleName === 'linkTextSpacing' && insideLink) value = value.replace(/\s+/g, ' ');
    copy.value = value;
}

function normalizeChildren(
    children: AnyNode[],
    parentType: string,
    ruleName: string | undefined,
    insideLink: boolean
): AnyNode[] {
    const isLink = parentType === 'link' || parentType === 'linkReference';
    const inLinkText = ruleName === 'linkTextSpacing' && (insideLink || isLink);
    let result = children.map((child) => normalizeNode(child, ruleName, insideLink || isLink));
    // linkTextSpacing legitimately turns a hard break inside link text into a
    // space, at any depth of inline nesting.
    if (inLinkText) result = collapseHardBreaks(result);
    if (ruleName === 'linkTextSpacing' && isLink) result = trimBoundaryText(result);
    return ruleName === 'listMarkers' ? mergeAdjacentBulletLists(result) : result;
}

/**
 * Replace `break` children with the single space the rule collapses them to,
 * then merge the text nodes that end up adjacent — re-parsing the rewritten
 * text yields one text node where the tree before the edit had text/break/text.
 */
function collapseHardBreaks(children: AnyNode[]): AnyNode[] {
    const result: AnyNode[] = [];
    for (const child of children) {
        const node: AnyNode = child.type === 'break' ? { type: 'text', value: ' ' } : child;
        const previous = result[result.length - 1];
        if (node.type === 'text' && previous?.type === 'text') {
            previous.value = `${previous.value as string}${node.value as string}`.replace(/\s+/g, ' ');
            continue;
        }
        result.push(node);
    }
    return result;
}

/**
 * Trim the text at the brackets the way the rule does, and drop a text node
 * that trimming empties — re-parsing omits it.
 */
function trimBoundaryText(children: AnyNode[]): AnyNode[] {
    const lastIndex = children.length - 1;
    return children
        .map((child, index) => {
            if (child.type !== 'text' || typeof child.value !== 'string') return child;
            let value = child.value;
            if (index === 0) value = value.trimStart();
            if (index === lastIndex) value = value.trimEnd();
            return { ...child, value };
        })
        .filter((child) => child.type !== 'text' || child.value !== '');
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
