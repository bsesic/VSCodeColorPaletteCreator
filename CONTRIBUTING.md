# Contributing to Color Palette Creator

Thanks for your interest in improving Color Palette Creator! Bug reports, feature ideas and pull requests are
welcome.

- 🐞 **Bugs and ideas:** open an issue on [GitHub](https://github.com/bsesic/VSCodeColorPaletteCreator/issues).
- 🔧 **Code:** fork the repository, create a branch and open a pull request against `development`.

## Development setup

The tooling (mocha, `vsce`, typescript-eslint) requires **Node.js 22** (see `.nvmrc`).

```bash
nvm use                                  # Node.js 22 from .nvmrc
npm install
git config core.hooksPath .githooks      # enable the pre-commit hook (once)
```

Press `F5` in VS Code to start an Extension Development Host with the extension loaded.

### Scripts

| Command | Description |
| --- | --- |
| `npm run compile` | Build the extension host (`out/`) and the webview (`media/out/`) |
| `npm run watch` | Rebuild the extension host on changes |
| `npm run lint` | Run ESLint |
| `npm test` | Compile and run the unit tests (mocha) |
| `npm run icon` | Render `images/icon.svg` to `images/icon.png` |
| `npm run l10n` | Update the English localization template `l10n/bundle.l10n.json` |
| `npm run package` | Create the `.vsix` package |

The pre-commit hook in `.githooks/` runs ESLint and the unit tests before every commit and switches to the
Node.js version from `.nvmrc` via nvm automatically.

## Project structure

| Folder | Content |
| --- | --- |
| `src/core/` | Side-effect free color logic shared by the extension host and the webview: conversions, harmonies, contrast, color vision simulation, image extraction, gradients, color scanning and exporters |
| `src/extension/` | Extension host: commands, webview panel, inline color provider, document color sync, persistence |
| `src/webview/` | Webview UI (tabs, components), compiled as ES modules to `media/out/` |
| `test/` | Unit tests for `src/core/` |
| `images/` | Icon source (`icon.svg`), rendered icon and README screenshots |
| `scripts/` | Build helper scripts |

New color logic belongs in `src/core/` and should come with unit tests.

## Localization

The extension follows the VS Code display language. All user-visible texts are English in the code and are
translated via bundles:

| File | Content |
| --- | --- |
| `package.nls.json`, `package.nls.<lang>.json` | Commands, settings and the description (`%key%` in `package.json`) |
| `l10n/bundle.l10n.json` | English template of all texts of the extension host and the webview (generated) |
| `l10n/bundle.l10n.<lang>.json` | Translations, keyed by the English text |

Supported languages: `de`, `fr`, `es`, `it`, `pt-br`, `ja`, `ko`, `zh-cn`, `zh-tw`, `ru`, `pl`, `cs`, `tr`.

When you add or change a text:

1. Wrap it in `t('…')` in the webview (`src/webview/i18n.ts`) or `vscode.l10n.t('…')` in the extension host.
   Use placeholders for values: `t('Copied {0}', text)`. Never build sentences from fragments.
2. Run `npm run l10n` to update `l10n/bundle.l10n.json`.
3. Add the translation to every `l10n/bundle.l10n.<lang>.json`.

`npm test` fails if the template is outdated or a language misses a text or uses different placeholders.

## Workflow

- `main` holds the releases and is used for deployment.
- `development` is the integration branch for ongoing work.
- Create a `feature/*` branch for features, a `bugfix/*` branch for bug fixes and a `chore/*` branch for
  everything else, then open a pull request against `development`.
- Reference the related issue in commits and pull requests (`Refs #12`, `Closes #12`).
- Code, comments, UI texts, commit messages and pull requests are written in English.

## Icon

The icon has a single source: `images/icon.svg`. After editing it, run `npm run icon` to update
`images/icon.png`, which is used as marketplace icon and as tab icon of the panel.

## Screenshots

README screenshots live in `images/screenshots/`. Crop them to the relevant part of VS Code and make sure they
do not show private paths, project names or other extensions.

## Releasing

1. Update the version in `package.json` and the `CHANGELOG.md`.
2. Merge `development` into `main` via pull request.
3. Tag the release (`git tag -a vX.Y.Z`) and create a GitHub release with the `.vsix` attached.
4. Publish to the marketplace:

   ```bash
   npm run package                 # creates vscode-color-palette-creator-<version>.vsix
   npx vsce login bsesic           # once, with an Azure DevOps personal access token
   npx vsce publish
   ```
