import { computeLineDiff } from './lineDiff';
import { renderDiffPreviewHtml } from './render';

function render(oldText: string, newText: string, skippedRules: string[] = []): string {
    return renderDiffPreviewHtml({
        hunks: computeLineDiff(oldText, newText),
        summary: '1 character added, 1 character removed',
        skippedRules,
    });
}

describe('renderDiffPreviewHtml', () => {
    test('renders the summary and a hunk header', () => {
        const html = render('* item\n', '- item\n');

        expect(html).toContain('1 character added, 1 character removed');
        expect(html).toContain('@@ -1,1 +1,1 @@');
    });

    test('marks changed spans inside replaced lines', () => {
        const html = render('* item\n', '- item\n');

        expect(html).toContain('<span class="mdfmt-line__change">*</span> item');
        expect(html).toContain('<span class="mdfmt-line__change">-</span> item');
    });

    test('escapes markup in note content', () => {
        // The changed character sits in its own highlight span, so the escaped
        // tag is split across elements: assert on the escaped pieces.
        const html = render('<b>a & b</b>\n', '<i>a & b</i>\n');

        expect(html).toContain('&lt;<span class="mdfmt-line__change">b</span>&gt;');
        expect(html).toContain('a &amp; b');
        expect(html).not.toContain('<b>');
        expect(html).not.toContain('</i>');
    });

    test('notes a missing final newline', () => {
        const html = render('a\nb', 'a\nb\n');

        expect(html).toContain('No newline at end of file');
    });

    test('surfaces skipped rules only when there are any', () => {
        expect(render('a\n', 'b\n')).not.toContain('structural safety check');
        expect(render('a\n', 'b\n', ['listSpacing'])).toContain('Skipped by the structural safety check: listSpacing');
    });

    test('renders an empty state when nothing changed', () => {
        const html = renderDiffPreviewHtml({ hunks: [], summary: '', skippedRules: [] });

        expect(html).toContain('No changes.');
    });
});
