import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createBuildOptions, createContentScriptBuildOptions } from '@bwat47/joplin-plugin-scripts';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));

test('the content-script bundle registers guarded editor commands without runtime dependencies', async () => {
    const result = await build({
        ...createContentScriptBuildOptions(root, 'contentScripts/codeMirror.ts'),
        write: false,
        metafile: true,
        logLevel: 'silent',
    });
    const inputs = Object.keys(result.metafile.inputs);
    assert.ok(!inputs.some((input) => /node_modules\/@(?:codemirror|lezer)\//.test(input)));
    assert.ok(inputs.some((input) => input.includes('node_modules/diff-match-patch-es/')));
    const imports = Object.values(result.metafile.outputs).flatMap((output) => output.imports);
    assert.equal(imports.length, 0);
    const module = { exports: {} };
    // Execute the production bundle in a webview-like context without Node APIs.
    // eslint-disable-next-line sonarjs/code-eval -- Executes only the bundle built from this repository, with a controlled host stub.
    runInNewContext(result.outputFiles[0].text, {
        module,
        exports: module.exports,
        console,
        require: (name) => {
            throw new Error(`Unexpected runtime dependency: ${name}`);
        },
    });
    assert.equal(typeof module.exports.default, 'function');
    const extension = module.exports.default();
    assert.equal(typeof extension.plugin, 'function');
    let text = '* item';
    const commands = new Map();
    extension.plugin({
        cm6: true,
        editor: {
            state: { doc: { toString: () => text } },
            dispatch: ({ changes }) => {
                for (const change of [...changes].reverse()) {
                    text = text.slice(0, change.from) + change.insert + text.slice(change.to);
                }
            },
        },
        registerCommand: (name, callback) => commands.set(name, callback),
    });
    assert.equal(commands.get('markdownFormatter__getNoteText')(), '* item');
    const setText = commands.get('markdownFormatter__setNoteText');
    assert.equal(setText('stale text', '- item'), false);
    assert.equal(text, '* item');
    assert.equal(setText('* item', '- item'), true);
    assert.equal(text, '- item');
});

test('the production bundle registers with Joplin without requiring any module', async () => {
    const result = await build({ ...createBuildOptions(root), write: false, metafile: true, logLevel: 'silent' });
    let registered = false;
    // Execute only the bundle just built from this repository. The main bundle also runs in the
    // mobile webview, which has no Node built-ins, so any runtime require is a failure.
    // eslint-disable-next-line sonarjs/code-eval -- Executes only the bundle built from this repository, with a controlled host stub.
    runInNewContext(result.outputFiles[0].text, {
        joplin: {
            plugins: {
                register: (plugin) => {
                    registered = typeof plugin.onStart === 'function';
                },
            },
        },
        console,
        setTimeout,
        clearTimeout,
        TextEncoder,
        TextDecoder,
        URL,
        URLSearchParams,
        require: (name) => {
            throw new Error(`Unexpected runtime dependency: ${name}`);
        },
    });
    assert.equal(registered, true);
});
