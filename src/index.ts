import joplin from 'api';
import { ContentScriptType, MenuItemLocation } from 'api/types';
import { EDITOR_CONTENT_SCRIPT_ID, GET_NOTE_TEXT_COMMAND, SET_NOTE_TEXT_COMMAND } from './constants';
import { formatMarkdown } from './formatter';
import { loadFormatterOptions, registerSettings } from './settings';
import logger from './logger';

joplin.plugins.register({
    onStart: async function () {
        await registerSettings();

        await joplin.contentScripts.register(
            ContentScriptType.CodeMirrorPlugin,
            EDITOR_CONTENT_SCRIPT_ID,
            './contentScripts/codeMirror.js'
        );

        await joplin.commands.register({
            name: 'formatMarkdownNote',
            label: 'Format Markdown',
            execute: async () => {
                try {
                    const currentText = await joplin.commands.execute('editor.execCommand', {
                        name: GET_NOTE_TEXT_COMMAND,
                    });
                    if (typeof currentText !== 'string') {
                        logger.warn('Could not read editor text; formatting skipped.');
                        return;
                    }

                    const options = await loadFormatterOptions();
                    const result = formatMarkdown(currentText, options);
                    if (result.skippedRules.length > 0) {
                        logger.warn('Rules skipped by the structural safety check:', result.skippedRules.join(', '));
                    }
                    if (result.text === currentText) {
                        logger.debug('Note already formatted; no changes.');
                        return;
                    }
                    // Replace via the content script so the change is a normal
                    // CodeMirror transaction (undoable), not an editor reload.
                    await joplin.commands.execute('editor.execCommand', {
                        name: SET_NOTE_TEXT_COMMAND,
                        args: [currentText, result.text],
                    });
                } catch (error) {
                    logger.error('Formatting failed; note left unchanged.', error);
                }
            },
        });

        await joplin.views.menuItems.create('formatMarkdownNoteMenuItem', 'formatMarkdownNote', MenuItemLocation.Edit, {
            accelerator: 'CmdOrCtrl+Alt+F',
        });

        logger.info('Plugin started.');
    },
});
