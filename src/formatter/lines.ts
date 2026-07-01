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
