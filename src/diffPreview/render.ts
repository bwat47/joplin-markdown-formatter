/**
 * Renders the diff model as static HTML for the Joplin dialog webview.
 *
 * No scripts: the dialog is a read-only view whose Apply/Cancel buttons are
 * supplied by Joplin itself. Styling lives in styles.css.
 */

import type { DiffHunk, DiffLine } from './lineDiff';

export interface DiffPreviewContent {
    hunks: DiffHunk[];
    /** Short change summary shown under the title, e.g. "12 characters added, 3 characters removed". */
    summary: string;
    /** Rules dropped by the structural safety check, surfaced as a warning. */
    skippedRules: string[];
}

const MARKERS: Record<DiffLine['kind'], string> = {
    context: ' ',
    add: '+',
    remove: '-',
};

const ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
};

function escapeHtml(text: string): string {
    return text.replace(/[&<>]/g, (char) => ESCAPES[char]);
}

export function renderDiffPreviewHtml(content: DiffPreviewContent): string {
    const parts: string[] = ['<div class="mdfmt-diff">', '<header class="mdfmt-diff__header">'];
    parts.push('<h2 class="mdfmt-diff__title">Review formatting changes</h2>');
    parts.push(`<p class="mdfmt-diff__summary">${escapeHtml(content.summary)}</p>`);
    if (content.skippedRules.length > 0) {
        parts.push(
            `<p class="mdfmt-diff__warning">Skipped by the structural safety check: ${escapeHtml(
                content.skippedRules.join(', ')
            )}</p>`
        );
    }
    parts.push('</header>');

    parts.push('<div class="mdfmt-diff__body">');
    if (content.hunks.length === 0) {
        parts.push('<p class="mdfmt-diff__empty">No changes.</p>');
    } else {
        for (const hunk of content.hunks) parts.push(renderHunk(hunk));
    }
    parts.push('</div></div>');

    return parts.join('');
}

function renderHunk(hunk: DiffHunk): string {
    const range = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
    const parts: string[] = ['<section class="mdfmt-hunk">'];
    parts.push(`<div class="mdfmt-hunk__header">${escapeHtml(range)}</div>`);
    for (const line of hunk.lines) {
        parts.push(renderLine(line));
        if (line.missingFinalNewline) parts.push(renderNoNewlineNote());
    }
    parts.push('</section>');
    return parts.join('');
}

function renderLine(line: DiffLine): string {
    const text = line.segments
        .map((segment) =>
            segment.changed
                ? `<span class="mdfmt-line__change">${escapeHtml(segment.text)}</span>`
                : escapeHtml(segment.text)
        )
        .join('');

    return [
        `<div class="mdfmt-line mdfmt-line--${line.kind}">`,
        `<span class="mdfmt-line__num">${line.oldNumber ?? ''}</span>`,
        `<span class="mdfmt-line__num">${line.newNumber ?? ''}</span>`,
        `<span class="mdfmt-line__marker">${escapeHtml(MARKERS[line.kind])}</span>`,
        `<span class="mdfmt-line__text">${text}</span>`,
        '</div>',
    ].join('');
}

function renderNoNewlineNote(): string {
    return [
        '<div class="mdfmt-line mdfmt-line--note">',
        '<span class="mdfmt-line__num"></span>',
        '<span class="mdfmt-line__num"></span>',
        '<span class="mdfmt-line__marker">\\</span>',
        '<span class="mdfmt-line__text">No newline at end of file</span>',
        '</div>',
    ].join('');
}
