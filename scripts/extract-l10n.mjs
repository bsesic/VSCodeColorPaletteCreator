// Collects all localizable texts and writes the English l10n template (l10n/bundle.l10n.json).
//
// Sources:
// - t('...') calls in the webview and vscode.l10n.t('...') calls in the extension host
// - labels and descriptions of the shared core lists (harmonies, vision types, export formats)
// - the base color names used for swatch names
//
// Run `npm run l10n` after changing texts; the unit tests fail if the template is outdated.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function files(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []);
}

const unescape = (text) => text.replace(/\\(['"\\])/g, '$1');
const keys = new Set();

// t('text') / vscode.l10n.t('text'), single or double quoted.
const call = /(?<![\w$])(?:vscode\.l10n\.)?t\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
for (const file of [...files('src/webview'), ...files('src/extension')]) {
  for (const match of readFileSync(join(root, file), 'utf8').matchAll(call)) {
    keys.add(unescape(match[1] ?? match[2]));
  }
}

// Texts of the core lists, translated where they are displayed.
const field = /\b(?:label|description):\s*'((?:[^'\\]|\\.)*)'/g;
for (const file of ['src/core/harmony.ts', 'src/core/blindness.ts', 'src/core/palette.ts']) {
  for (const match of readFileSync(join(root, file), 'utf8').matchAll(field)) {
    keys.add(unescape(match[1]));
  }
}

// Base color names (see describeColorParts in src/core/color.ts).
const color = readFileSync(join(root, 'src/core/color.ts'), 'utf8');
for (const match of color.matchAll(/\[\d+, '([A-Za-z]+)'\]/g)) {
  keys.add(match[1]);
}
for (const match of color.matchAll(/hue: '([A-Za-z]+)'/g)) {
  keys.add(match[1]);
}

const sorted = [...keys].sort((a, b) => a.localeCompare(b, 'en'));
const bundle = Object.fromEntries(sorted.map((key) => [key, key]));
const output = `${JSON.stringify(bundle, null, 2)}\n`;
const target = join(root, 'l10n/bundle.l10n.json');

if (process.argv.includes('--check')) {
  // Used by the unit tests: fail if the committed template does not match the code.
  if (readFileSync(target, 'utf8') !== output) {
    console.error('l10n/bundle.l10n.json is outdated. Run `npm run l10n`.');
    process.exit(1);
  }
} else {
  writeFileSync(target, output);
  console.log(`l10n/bundle.l10n.json: ${sorted.length} texts`);
}
