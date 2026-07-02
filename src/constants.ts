/** IDs shared between the plugin main process and the editor content script. */

export const EDITOR_CONTENT_SCRIPT_ID = 'markdownFormatterCodeMirror';

/** Editor command (registered by the content script) that returns the live note text. */
export const GET_NOTE_TEXT_COMMAND = 'markdownFormatter__getNoteText';

/** Editor command (registered by the content script) that replaces the note text undoably. */
export const SET_NOTE_TEXT_COMMAND = 'markdownFormatter__setNoteText';
