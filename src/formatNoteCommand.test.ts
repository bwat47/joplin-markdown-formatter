import { vi } from 'vitest';
import { DEFAULT_OPTIONS } from './formatter';
import { executeFormatMarkdownNote, type FormatNoteCommandDependencies } from './formatNoteCommand';

describe('executeFormatMarkdownNote', () => {
    test('writes and previews only the first of two repeated formatting commands', async () => {
        let editorText = '* item';
        const readEditorText = vi.fn(async () => editorText);
        const writeEditorText = vi.fn(async (expectedText: string, formattedText: string) => {
            if (editorText !== expectedText) return false;
            editorText = formattedText;
            return true;
        });
        const confirmChanges = vi.fn(async () => true);
        const dependencies: FormatNoteCommandDependencies = {
            readEditorText,
            writeEditorText,
            loadFormatterOptions: async () => DEFAULT_OPTIONS,
            loadDisplayToastMessages: async () => false,
            loadShowDiffPreview: async () => true,
            confirmChanges,
            showToast: vi.fn(async () => undefined),
            logger: {
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        };

        await executeFormatMarkdownNote(dependencies);
        await executeFormatMarkdownNote(dependencies);

        expect(editorText).toBe('- item\n');
        expect(readEditorText).toHaveBeenCalledTimes(2);
        expect(confirmChanges).toHaveBeenCalledTimes(1);
        expect(writeEditorText).toHaveBeenCalledTimes(1);
    });
});
