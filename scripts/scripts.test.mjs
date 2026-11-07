import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { list } from 'tar';

import {
    buildOptions,
    contentScriptBuildOptions,
    contentScriptExternals,
    isRuntimeAsset,
    readExtraScripts,
    root,
} from './buildConfig.mjs';
import { packagePlugin, readProject, VALID_CATEGORIES } from './packagePlugin.mjs';
import { compareGeneratorLists, replaceApi } from './updateApi.mjs';
import { updateVersion } from './updateVersion.mjs';

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'markdown-formatter-build-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(path.join(directory, 'src'));
    await mkdir(path.join(directory, 'dist'));
    const manifest = { id: 'test.formatter', version: '1.2.3', categories: ['productivity'] };
    await writeFile(path.join(directory, 'src/manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'dist/manifest.json'), JSON.stringify(manifest));
    await writeFile(path.join(directory, 'dist/index.js'), '/* bundled plugin */');
    await writeFile(
        path.join(directory, 'package.json'),
        JSON.stringify({
            name: 'joplin-plugin-test',
            version: '1.2.3',
            keywords: ['joplin-plugin'],
        })
    );
    return { directory, manifest };
}

test('packages the runtime files at archive root, without dotfiles, with matching publish metadata', async (t) => {
    const { directory, manifest } = await fixture(t);
    await mkdir(path.join(directory, 'dist/assets'));
    await mkdir(path.join(directory, 'dist/empty'));
    await writeFile(path.join(directory, 'dist/assets/example.css'), 'body {}');
    await writeFile(path.join(directory, 'dist/assets/.DS_Store'), 'finder metadata');
    await mkdir(path.join(directory, 'dist/.cache'));
    await writeFile(path.join(directory, 'dist/.cache/state.json'), '{}');
    await packagePlugin(directory, manifest);
    const publish = path.join(directory, 'publish');
    assert.deepEqual((await readdir(publish)).sort(), ['test.formatter.jpl', 'test.formatter.json']);
    const archive = path.join(publish, 'test.formatter.jpl');
    const entries = [];
    await list({ file: archive, onReadEntry: (entry) => entries.push(entry.path) });
    assert.deepEqual(entries.sort(), ['assets/example.css', 'index.js', 'manifest.json']);
    const info = JSON.parse(await readFile(path.join(publish, 'test.formatter.json'), 'utf8'));
    const hash = createHash('sha256')
        .update(await readFile(archive))
        .digest('hex');
    assert.deepEqual(info, { ...manifest, _publish_hash: `sha256:${hash}`, _publish_commit: '' });
});

test('rejects a build without the main plugin bundle', async (t) => {
    const { directory, manifest } = await fixture(t);
    await rm(path.join(directory, 'dist/index.js'));
    await assert.rejects(packagePlugin(directory, manifest), { code: 'ENOENT' });
});

test('rejects a build missing a registered extra script', async (t) => {
    const { directory, manifest } = await fixture(t);
    await assert.rejects(packagePlugin(directory, manifest, ['contentScripts/codeMirror.js']), {
        code: 'ENOENT',
    });
});

test('propagates archive write failures', async (t) => {
    const { directory, manifest } = await fixture(t);
    await writeFile(path.join(directory, 'publish'), 'blocks output directory');
    await assert.rejects(packagePlugin(directory, manifest));
});

test('reads extra scripts and explains a missing or malformed plugin config', async (t) => {
    const { directory } = await fixture(t);
    const configPath = path.join(directory, 'plugin.config.json');
    await assert.rejects(readExtraScripts(directory), /Could not read .*plugin\.config\.json/);
    await writeFile(configPath, '{}');
    await assert.rejects(readExtraScripts(directory), /must define "extraScripts"/);
    await writeFile(configPath, JSON.stringify({ extraScripts: 'contentScripts/a.ts' }));
    await assert.rejects(readExtraScripts(directory), /must define "extraScripts"/);
    await writeFile(configPath, JSON.stringify({ extraScripts: ['contentScripts/a.ts'] }));
    assert.deepEqual(await readExtraScripts(directory), ['contentScripts/a.ts']);
});

test('packages the content script at its registered runtime path', async (t) => {
    const { directory, manifest } = await fixture(t);
    await mkdir(path.join(directory, 'dist/contentScripts'));
    await writeFile(path.join(directory, 'dist/contentScripts/codeMirror.js'), 'exports.default = () => ({});');
    await packagePlugin(directory, manifest, ['contentScripts/codeMirror.js']);
    const entries = [];
    await list({
        file: path.join(directory, 'publish/test.formatter.jpl'),
        onReadEntry: (entry) => entries.push(entry.path),
    });
    assert.deepEqual(entries.sort(), ['contentScripts/codeMirror.js', 'index.js', 'manifest.json']);
});

test('the content-script bundle registers guarded editor commands without runtime dependencies', async () => {
    const result = await build({
        ...contentScriptBuildOptions('contentScripts/codeMirror.ts'),
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

test('copies runtime assets while excluding TypeScript, tests, and formatter fixtures', () => {
    for (const relative of ['manifest.json', 'diffPreview/styles.css', 'worker.js']) {
        assert.equal(isRuntimeAsset(path.join(root, 'src', relative)), true, relative);
    }
    for (const relative of [
        'index.ts',
        'view.tsx',
        'worker.mts',
        'config.cts',
        'types.d.ts',
        'render.test.js',
        'render.spec.mjs',
        '__tests__/example.json',
        'formatter/fixtures',
        'formatter/fixtures/example/input.md',
        'formatter/fixtures/example/expected.md',
        'formatter/fixtures/example/options.json',
    ]) {
        assert.equal(isRuntimeAsset(path.join(root, 'src', relative)), false, relative);
    }
});

test('validates manifest versions, categories, and local screenshots before building', async (t) => {
    const { directory, manifest } = await fixture(t);
    await readProject(directory);
    for (const [change, message] of [
        [{ version: '9.0.0' }, /versions must match/],
        [{ categories: ['unknown'] }, /categories/],
        [{ categories: ['editor', 'editor'] }, /categories/],
        [{ screenshots: [{}] }, /specify src/],
        [{ screenshots: [{ src: 'missing.png' }] }, /ENOENT/],
    ]) {
        await writeFile(path.join(directory, 'src/manifest.json'), JSON.stringify({ ...manifest, ...change }));
        await assert.rejects(readProject(directory), message);
    }
});

test('bumps package, manifest, and both lockfile versions together', async (t) => {
    const { directory } = await fixture(t);
    await writeFile(
        path.join(directory, 'package-lock.json'),
        JSON.stringify({
            version: '1.2.3',
            packages: { '': { version: '1.2.3' } },
        })
    );
    await updateVersion(directory);
    const { packageJson, manifest } = await readProject(directory);
    const lock = JSON.parse(await readFile(path.join(directory, 'package-lock.json'), 'utf8'));
    assert.equal(packageJson.version, '1.2.4');
    assert.equal(manifest.version, '1.2.4');
    assert.equal(lock.version, '1.2.4');
    assert.equal(lock.packages[''].version, '1.2.4');
});

test('version bumps change only the version in hand-formatted package.json and manifest', async (t) => {
    const { directory } = await fixture(t);
    const manifestText = (version) =>
        `{\n    "manifest_version": 1,\n    "id": "test.formatter",\n    "version": "${version}",\n` +
        `    "categories": ["productivity", "editor"],\n    "promo_tile": {\n        "src": "promo.png"\n    }\n}\n`;
    const packageText = (version) =>
        `{\n    "name": "joplin-plugin-test",\n    "version": "${version}",\n` +
        `    "keywords": [\n        "joplin-plugin"\n    ],\n    "devDependencies": { "dep": "1.2.3" }\n}\n`;
    await writeFile(path.join(directory, 'src/manifest.json'), manifestText('1.2.3'));
    await writeFile(path.join(directory, 'package.json'), packageText('1.2.3'));
    await writeFile(
        path.join(directory, 'package-lock.json'),
        JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } })
    );
    await updateVersion(directory);
    assert.equal(await readFile(path.join(directory, 'src/manifest.json'), 'utf8'), manifestText('1.2.4'));
    assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText('1.2.4'));
});

test('version bumps write nothing when a version entry is ambiguous', async (t) => {
    const { directory, manifest } = await fixture(t);
    const ambiguousManifest = JSON.stringify({ ...manifest, nested: { version: '1.2.3' } });
    await writeFile(path.join(directory, 'src/manifest.json'), ambiguousManifest);
    const lockText = JSON.stringify({ version: '1.2.3', packages: { '': { version: '1.2.3' } } });
    await writeFile(path.join(directory, 'package-lock.json'), lockText);
    const packageText = await readFile(path.join(directory, 'package.json'), 'utf8');
    await assert.rejects(updateVersion(directory), /Expected one "version"/);
    assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText);
    assert.equal(await readFile(path.join(directory, 'src/manifest.json'), 'utf8'), ambiguousManifest);
    assert.equal(await readFile(path.join(directory, 'package-lock.json'), 'utf8'), lockText);
});

test('version bumps explain a lockfile without a root entry or out of sync, and write nothing', async (t) => {
    const { directory } = await fixture(t);
    const lockPath = path.join(directory, 'package-lock.json');
    const packageText = await readFile(path.join(directory, 'package.json'), 'utf8');
    for (const [lock, message] of [
        [{ version: '1.2.3' }, /no root package entry/],
        [{ version: '1.2.3', packages: { '': { version: '1.0.0' } } }, /do not match package\.json/],
        [{ version: '1.0.0', packages: { '': { version: '1.2.3' } } }, /do not match package\.json/],
    ]) {
        await writeFile(lockPath, JSON.stringify(lock));
        await assert.rejects(updateVersion(directory), message);
        assert.equal(await readFile(lockPath, 'utf8'), JSON.stringify(lock));
        assert.equal(await readFile(path.join(directory, 'package.json'), 'utf8'), packageText);
    }
});

test('the production bundle registers with Joplin without requiring any module', async () => {
    const result = await build({ ...buildOptions, write: false, metafile: true, logLevel: 'silent' });
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

/** Builds text shaped like generator-joplin's webpack.config.js lists. */
function generatorWebpackConfig(categories, externals) {
    const categoryEntries = categories.map((name) => `{'name':'${name}'}`).join(',');
    const externalEntries = externals.map((name) => `\t'${name}',\n`).join('');
    return (
        `const allPossibleCategories = [${categoryEntries}];\n` +
        `const externalContentScriptLibraries = [\n${externalEntries}];\n`
    );
}

test('reports no generator list warnings when categories and externals match', () => {
    assert.deepEqual(compareGeneratorLists(generatorWebpackConfig([...VALID_CATEGORIES], contentScriptExternals)), []);
});

test('warns when the generator categories or content-script externals differ', () => {
    const categories = [...VALID_CATEGORIES].filter((category) => category !== 'themes').concat('new category');
    const externals = [...contentScriptExternals, '@codemirror/new-package'];
    const warnings = compareGeneratorLists(generatorWebpackConfig(categories, externals));
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /plugin categories.*missing new category; not in generator themes.*VALID_CATEGORIES/);
    assert.match(warnings[1], /content-script externals.*missing @codemirror\/new-package.*contentScriptExternals/);
});

test('warns when the generator lists cannot be found', () => {
    const warnings = compareGeneratorLists('module.exports = {};');
    assert.equal(warnings.length, 2);
    assert.ok(warnings.every((warning) => /Could not find/.test(warning)));
});

async function apiFixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'markdown-formatter-api-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await mkdir(path.join(directory, 'api'));
    await writeFile(path.join(directory, 'api/index.ts'), 'old');
    await writeFile(path.join(directory, 'api/Stale.d.ts'), 'stale');
    return directory;
}

test('replaces api/ with the generator copy and leaves no staging directories', async (t) => {
    const directory = await apiFixture(t);
    const source = path.join(directory, 'generator-api');
    await mkdir(path.join(source, 'types'), { recursive: true });
    await writeFile(path.join(source, 'index.ts'), 'new');
    await writeFile(path.join(source, 'types/index.ts'), 'types');
    await replaceApi(directory, source);
    assert.deepEqual((await readdir(path.join(directory, 'api'))).sort(), ['index.ts', 'types']);
    assert.equal(await readFile(path.join(directory, 'api/index.ts'), 'utf8'), 'new');
    assert.deepEqual((await readdir(directory)).sort(), ['api', 'generator-api']);
});

test('leaves api/ unchanged when the generator API is missing or cannot be copied', async (t) => {
    const directory = await apiFixture(t);
    await assert.rejects(replaceApi(directory, path.join(directory, 'missing')), { code: 'ENOENT' });
    const source = path.join(directory, 'generator-api');
    await mkdir(source);
    await writeFile(path.join(source, 'index.ts'), 'new');
    // Fail after part of the new API has been written to staging.
    const failingCopy = async (from, to) => {
        await writeFile(path.join(to, 'index.ts'), 'partial');
        throw new Error('copy failed');
    };
    await assert.rejects(replaceApi(directory, source, failingCopy), /copy failed/);
    assert.deepEqual((await readdir(path.join(directory, 'api'))).sort(), ['Stale.d.ts', 'index.ts']);
    assert.equal(await readFile(path.join(directory, 'api/index.ts'), 'utf8'), 'old');
    assert.deepEqual((await readdir(directory)).sort(), ['api', 'generator-api']);
});
