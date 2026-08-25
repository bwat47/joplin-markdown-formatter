import joplin from 'api';
import { ContentScriptType, MenuItemLocation, ToastType, ToolbarButtonLocation } from 'api/types';
import { EDITOR_CONTENT_SCRIPT_ID, GET_NOTE_TEXT_COMMAND, SET_NOTE_TEXT_COMMAND } from './constants';
import { confirmFormattingChanges, registerDiffPreviewDialog } from './diffPreview/dialog';
import { executeFormatMarkdownNote, type FormatNoteCommandDependencies } from './formatNoteCommand';
import { loadDisplayToastMessages, loadFormatterOptions, loadShowDiffPreview, registerSettings } from './settings';
import logger from './logger';

const formatNoteCommandDependencies: FormatNoteCommandDependencies = {
    readEditorText: async () =>
        joplin.commands.execute('editor.execCommand', {
            name: GET_NOTE_TEXT_COMMAND,
        }),
    // Replace via the content script so the change is a normal CodeMirror
    // transaction (undoable), not an editor reload.
    writeEditorText: async (expectedText, formattedText) =>
        joplin.commands.execute('editor.execCommand', {
            name: SET_NOTE_TEXT_COMMAND,
            args: [expectedText, formattedText],
        }),
    loadFormatterOptions,
    loadDisplayToastMessages,
    loadShowDiffPreview,
    confirmChanges: confirmFormattingChanges,
    showToast: async (toast) => {
        await joplin.views.dialogs.showToast({
            message: toast.message,
            type: toast.type === 'info' ? ToastType.Info : ToastType.Success,
        });
    },
    logger,
};

joplin.plugins.register({
    onStart: async function () {
        await registerSettings();
        await registerDiffPreviewDialog();

        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            EDITOR_CONTENT_SCRIPT_ID,
            './contentScripts/codeMirror.js'
        );

        await joplin.commands.register({
            name: 'formatMarkdownNote',
            label: 'Format Markdown',
            iconName: 'fas fa-align-left',
            execute: async () => executeFormatMarkdownNote(formatNoteCommandDependencies),
        });

        await joplin.views.menuItems.create('formatMarkdownNoteMenuItem', 'formatMarkdownNote', MenuItemLocation.Edit, {
            accelerator: 'CmdOrCtrl+Alt+F',
        });
        await joplin.views.toolbarButtons.create(
            'formatMarkdownNoteToolbarButton',
            'formatMarkdownNote',
            ToolbarButtonLocation.EditorToolbar
        );

        logger.info('Plugin started.');
    },
});
