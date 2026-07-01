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

/** Like {@link walk}, but passes the ancestor chain (outermost first) to the visitor. */
export function walkWithAncestors(
    node: Node,
    visit: (node: Node, ancestors: Node[]) => void,
    ancestors: Node[] = []
): void {
    visit(node, ancestors);
    const children = (node as Parent).children;
    if (!children) return;
    const childAncestors = [...ancestors, node];
    for (const child of children) {
        walkWithAncestors(child, visit, childAncestors);
    }
}
