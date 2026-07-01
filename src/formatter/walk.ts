import type { Node, Parent } from 'unist';

/** Depth-first pre-order traversal of an mdast/unist tree. */
export function walk(node: Node, visit: (node: Node) => void): void {
    visit(node);
    const children = (node as Parent).children;
    if (!children) return;
    for (const child of children) {
        walk(child, visit);
    }
}
