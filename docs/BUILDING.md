# Building the plugin

Requires Node 22 or later. Install dependencies and build the plugin:

```sh
npm ci
npm run dist
```

The build checks TypeScript, bundles with esbuild, and creates:

- `dist/`: the plugin bundles and runtime assets, without tests or formatter fixtures.
- `publish/com.bwat47.joplin-markdown-formatter.jpl`: the installable plugin.
- `publish/com.bwat47.joplin-markdown-formatter.json`: publish metadata.

Each build clears `dist/` and `publish/` first. Extra content scripts are read from
`plugin.config.json`; their output paths remain relative to `dist/`. The main bundle
includes the Joplin API shim and runtime enums through the `tsconfig.json` path aliases.
Content scripts target the browser and keep Joplin's CodeMirror and Lezer libraries external.

## Maintenance

- `npm run updateVersion`: increment the patch version in `package.json`,
  `src/manifest.json`, and `package-lock.json` together. Their versions must match
  before bumping. Hand-formatted package and manifest files retain their formatting.
- `npm run updateApi`: update `api/` from the latest `generator-joplin` package
  without regenerating the project. Review `git diff api/`, address any category
  or content-script external warnings, and run `npm run typecheck` afterward.

## Verification

- `npm test`: run application and build-script tests.
- `npm run typecheck`: check TypeScript without producing output.
- `npm run lint`: lint application sources and build scripts.
- `npm run format:check`: check formatting.
- `npm run knip`: check for unused dependencies, exports, and files.
- `npm run dist`: build and package the plugin.

Before releasing, install the `.jpl` in Joplin on desktop and mobile. Check the
formatting command, diff preview, guarded editor updates, and undo/redo.
