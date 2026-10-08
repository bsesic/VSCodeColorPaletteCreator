# Changelog

## 1.1.0

### New

- 🌍 **14 languages:** the user interface follows the VS Code display language and is available in English,
  German, French, Spanish, Italian, Portuguese (Brazil), Japanese, Korean, Chinese (Simplified and Traditional),
  Russian, Polish, Czech and Turkish.
- ⌨️ **More commands:** open each tool directly, export and import saved palettes, toggle inline color boxes.
- **Keyboard shortcuts:** `Ctrl+Alt+P` / `Cmd+Alt+P` opens the panel, `Ctrl+Alt+Shift+P` / `Cmd+Alt+Shift+P`
  the Document tab.
- **Context menus:** edit the colors of the current file and insert saved palettes from the editor context menu;
  extract colors from an image directly from the explorer context menu.

### Changed

- Renamed to **Color Palette Creator** with a new icon.
- New README with screenshots of all tools, plus a CONTRIBUTING.md for developers.
- Support options: Buy Me a Coffee, GitHub Sponsors and crypto donations.

### Fixed

- The Document tab showed absolute file paths for files outside the workspace.
- Swatch color labels were truncated in narrow swatches or wrapped in the middle of a value.
- Marketplace badges in the README (the retired shields.io badges were replaced).

## 1.0.0

First public release.

- Inline color boxes with color picker for HEX, RGB(A), HSL(A), HSV(A) and Bootstrap RGB triplets in all languages.
- Document tab: edit the colors of the open file live, with optional auto-save.
- Document tab: clicking a swatch jumps to its occurrences in the editor (cycling, wraps around).

### Included from the initial development version

- Palette editor, color picker with eyedropper, color wheel with harmonies, image palette and
  gradient extraction, gradient generator, contrast checker, color blindness simulator, palette management with
  export/import and color history.
