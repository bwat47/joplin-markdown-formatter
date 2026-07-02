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

    test('heading depth normalization is ignored', () => {
        expect(equal('# a\n\n#### b\n', '# a\n\n## b\n')).toBe(true);
    });

    test('adjacent bullet lists merged by marker normalization are equal', () => {
        expect(equal('* a\n\n- b\n', '- a\n- b\n')).toBe(true);
    });

    test('changed emphasis nesting is detected', () => {
        expect(equal('*_x_*\n', '__x__\n')).toBe(false);
    });

    test('a heading turning into a paragraph is detected', () => {
        expect(equal('# title\n', 'title\n')).toBe(false);
    });

    test('text swallowed into a code block is detected', () => {
        expect(equal('- a\n\n  text\n', '- a\n\n      text\n')).toBe(false);
    });
});
