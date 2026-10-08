# VSCode Color Palette Creator

Pick, extract and generate color palettes inside Visual Studio Code and use them directly in your code.

## Features

- **Palette editor**: starts with 5 swatches; add or delete colors (2 to 12), change them, copy the color code,
  reorder with drag and drop, lock swatches, edit tints/shades and choose the base color.
- **Color picker**: saturation/brightness area, hue slider, RGB/HSL/HSV sliders (including lightness and
  brightness), HEX/RGB/HSL input fields, preset swatches and an eyedropper that picks colors from the screen.
- **Color wheel and harmonies**: generate palettes with Custom, Analogous, Complementary, Split Complementary,
  Triad, Square, Compound, Shades, Monochromatic or Random harmonies. Drag the markers on the wheel to rotate the
  harmony or move individual colors.
- **Image extraction**: upload an image (file dialog, drag and drop or paste). The dominant colors are picked
  automatically (k-means); move the markers or click to add your own. Extract gradients along a line.
- **Gradient generator**: linear, radial and conic gradients, editable stops, angle, interpolation in OKLab,
  RGB or HSL, CSS output and gradient steps as a palette.
- **Contrast checker**: WCAG 2.x ratio with AA/AAA ratings for text and UI components, a live preview,
  suggestions for passing colors and a contrast matrix of the palette.
- **Color blindness simulator**: protanopia, deuteranopia, tritanopia, their anomalous variants and
  achromatopsia for the palette (with warnings for colors that become hard to distinguish) and for images.
- **Palette management**: save, rename, duplicate, edit, delete and search palettes; export as CSS, SCSS, LESS,
  JSON, Tailwind config, JS/TS, GIMP palette or plain text; save as PNG image; import palette files; insert
  palettes into the active editor.
- **Document colors**: the *Document* tab shows the colors of the open file as swatches, grouped by value with
  variable names (e.g. `--bs-primary`), occurrence count and line links. Changing a swatch rewrites all its
  occurrences in the file at once (HEX, functions and Bootstrap `-rgb` triplets keep their notation). Enable
  *Auto-save* to see the result immediately with live reload servers.
- **Inline color boxes**: a small color box with VS Code's color picker in front of HEX, RGB(A), HSL(A) and
  HSV(A) codes in every language, plus Bootstrap style RGB triplets (`--bs-primary-rgb: 13, 110, 253`). Editing
  keeps the original notation. In CSS, SCSS and LESS only the formats missing in VS Code's built-in picker are
  added, so no duplicate boxes appear.
- **History** of recently used colors, undo/redo and automatic persistence of the working palette.

## Usage

Run **Color Palette: Open Color Palette Creator** from the command palette or click the **Palette** button in the
status bar.

| Shortcut (in the panel) | Action |
| --- | --- |
| `Space` | Generate a new palette with the current harmony |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

Other commands:

- **Color Palette: Insert Saved Palette...**: insert a saved palette in any export format at the cursor.
- **Color Palette: Clear Color History**

### Settings

| Setting | Default | Description |
| --- | --- | --- |
| `colorPaletteCreator.historySize` | `60` | Number of colors kept in the history |
| `colorPaletteCreator.defaultExportFormat` | `css` | Format used for inserting palettes |
| `colorPaletteCreator.showStatusBarItem` | `true` | Show the status bar button |
| `colorPaletteCreator.documentColors.autoSave` | `false` | Save the file after color changes in the Document tab |
| `colorPaletteCreator.inlineColors.enabled` | `true` | Show inline color boxes in the editor |
| `colorPaletteCreator.inlineColors.excludedLanguages` | `[]` | Languages without inline color boxes |
| `colorPaletteCreator.inlineColors.builtInLanguages` | `["css", "scss", "less"]` | Languages with a built-in color provider (only missing formats are added) |

## Development

```bash
npm install
npm run compile   # build extension host and webview
npm run lint      # ESLint
npm test          # unit tests (mocha)
```

Press `F5` in VS Code to start an Extension Development Host.

The git pre-commit hook in `.githooks/` runs the linters and the tests. Enable it once with
`git config core.hooksPath .githooks`.

### Project structure

- `src/core/`: side-effect free color logic shared by the extension host and the webview (conversions,
  harmonies, contrast, color vision simulation, extraction, gradients, exporters). Covered by unit tests in `test/`.
- `src/extension/`: extension host (commands, webview panel, persistence).
- `src/webview/`: webview UI, compiled as ES modules to `media/out/`.

### Branching

- `main`: releases and deployment
- `development`: ongoing development
- `feature/*`, `bugfix/*`: feature and bugfix branches, merged into `development` via pull requests
