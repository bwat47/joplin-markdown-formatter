import { parseMarkdown } from './parse';
import { isStructurallyEqual } from './verify';

const equal = (a: string, b: string): boolean => isStructurallyEqual(parseMarkdown(a), parseMarkdown(b));

describe('isStructurallyEqual', () => {
    test('identical documents are equal', () => {
        expect(equal('# Title\n\nBody.\n', '# Title\n\nBody.\n')).toBe(true);
    });

    test('blank-line collapsing is structurally neutral', () => {
        expect(equal('a\n\n\n\nb\n', 'a\n\nb\n')).toBe(true);
    });

    test('tight/loose list spacing is ignored', () => {
        expect(equal('- a\n- b\n', '- a\n\n- b\n')).toBe(true);
    });

    test('heading depth normalization is ignored for headingLevels', () => {
        const before = parseMarkdown('# a\n\n#### b\n');
        const after = parseMarkdown('# a\n\n## b\n');
        expect(isStructurallyEqual(before, after, 'headingLevels')).toBe(true);
        // Not exempt for other rules: no one else may change heading depth.
        expect(isStructurallyEqual(before, after, 'headingMarkerSpacing')).toBe(false);
    });

    test('quote character conversion is ignored for quoteStyle', () => {
        const before = parseMarkdown('He said “hi” and ‘bye’.\n');
        const after = parseMarkdown('He said "hi" and \'bye\'.\n');
        expect(isStructurallyEqual(before, after, 'quoteStyle')).toBe(true);
        // Not exempt for other rules: no one else may rewrite quote characters.
        expect(isStructurallyEqual(before, after, 'emphasisStyle')).toBe(false);
    });

    test('adjacent bullet lists merged by marker normalization are equal for listMarkers', () => {
        const before = parseMarkdown('* a\n\n- b\n');
        const after = parseMarkdown('- a\n- b\n');
        expect(isStructurallyEqual(before, after, 'listMarkers')).toBe(true);
        // Not exempt for other rules: no one else may merge sibling lists.
        expect(isStructurallyEqual(before, after, 'listSpacing')).toBe(false);
    });

    test('changed emphasis nesting is detected', () => {
        expect(equal('*_x_*\n', '__x__\n')).toBe(false);
    });

    test('link-text whitespace normalization is ignored for linkTextSpacing', () => {
        const before = parseMarkdown('[ a   link ](https://example.com/)\n');
        const after = parseMarkdown('[a link](https://example.com/)\n');
        expect(isStructurallyEqual(before, after, 'linkTextSpacing')).toBe(true);
        // Not exempt for other rules.
        expect(isStructurallyEqual(before, after)).toBe(false);
    });

    test('link-text normalization ignores removed whitespace-only boundary nodes', () => {
        const before = parseMarkdown('[ *bold* ](https://example.com/)\n');
        const after = parseMarkdown('[*bold*](https://example.com/)\n');
        expect(isStructurallyEqual(before, after, 'linkTextSpacing')).toBe(true);
    });

    test('link-text normalization still detects removed spaces around inline nodes', () => {
        const before = parseMarkdown('[a *bold* c](https://example.com/)\n');
        const after = parseMarkdown('[a*bold*c](https://example.com/)\n');
        expect(isStructurallyEqual(before, after, 'linkTextSpacing')).toBe(false);
    });

    test('a heading turning into a paragraph is detected', () => {
        expect(equal('# title\n', 'title\n')).toBe(false);
    });

    test('text swallowed into a code block is detected', () => {
        expect(equal('- a\n\n  text\n', '- a\n\n      text\n')).toBe(false);
    });
});
