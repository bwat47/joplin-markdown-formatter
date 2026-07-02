/** Start offset of every line in `text` (line i spans [starts[i], starts[i + 1] ?? text.length)). */
export function computeLineStarts(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '\n') starts.push(i + 1);
    }
    // A trailing newline produces a phantom zero-length final "line"; drop it.
    if (starts.length > 1 && starts[starts.length - 1] === text.length) {
        starts.pop();
    }
    return starts;
}

/**
 * True if the line contains only whitespace.
 * Matches "\n", "   \n", "\t\r\n", and a whitespace-only final line without a newline.
 */
export function isBlankLine(text: string, lineStart: number, lineEnd: number): boolean {
    return /^[ \t]*\r?\n?$/.test(text.slice(lineStart, lineEnd));
}

/** Index of the line containing `offset` (greatest i with starts[i] <= offset). */
export function lineIndexOfOffset(lineStarts: number[], offset: number): number {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (lineStarts[mid] <= offset) low = mid;
        else high = mid - 1;
    }
    return low;
}

/**
 * Display width of a line prefix, expanding tabs to the next multiple of
 * `tabSize` (CommonMark uses a tab stop of 4). Non-tab characters count as
 * one column each, e.g. columnWidth('\t- ') === 6.
 */
export function columnWidth(prefix: string, tabSize = 4): number {
    let col = 0;
    for (const ch of prefix) {
        col = ch === '\t' ? (Math.floor(col / tabSize) + 1) * tabSize : col + 1;
    }
    return col;
}

/**
 * The tail of a whitespace prefix that lies beyond display column `col`,
 * preserved verbatim so content-internal indentation (e.g. inside code
 * blocks) survives reindentation. A tab straddling the boundary is replaced
 * by the equivalent spaces for the part beyond it.
 */
export function indentBeyondColumn(ws: string, col: number, tabSize = 4): string {
    let current = 0;
    for (let i = 0; i < ws.length; i++) {
        if (current >= col) return ws.slice(i);
        const next = ws[i] === '\t' ? (Math.floor(current / tabSize) + 1) * tabSize : current + 1;
        if (next > col) {
            // The character straddles the boundary; pad the overshoot with spaces.
            return ' '.repeat(next - col) + ws.slice(i + 1);
        }
        current = next;
    }
    return '';
}
