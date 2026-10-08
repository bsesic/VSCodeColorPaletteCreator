import * as assert from 'assert';
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Display languages with official VS Code language packs. */
export const LANGUAGES = ['de', 'fr', 'es', 'it', 'pt-br', 'ja', 'ko', 'zh-cn', 'zh-tw', 'ru', 'pl', 'cs', 'tr'];

// Tests run from out/extension/test, the project root is three levels up.
const root = join(__dirname, '..', '..', '..');
const readJson = (file: string): Record<string, string> =>
  JSON.parse(readFileSync(join(root, file), 'utf8')) as Record<string, string>;
const placeholders = (text: string): string[] => (text.match(/\{\d+\}/g) ?? []).sort();

function checkTranslations(template: Record<string, string>, file: string): void {
  assert.ok(existsSync(join(root, file)), `${file} is missing`);
  const translated = readJson(file);
  const missing = Object.keys(template).filter((key) => !(key in translated));
  const extra = Object.keys(translated).filter((key) => !(key in template));
  assert.deepStrictEqual(missing, [], `${file}: missing keys`);
  assert.deepStrictEqual(extra, [], `${file}: unknown keys`);
  for (const [key, value] of Object.entries(translated)) {
    assert.ok(typeof value === 'string' && value.trim().length > 0, `${file}: empty translation for "${key}"`);
    assert.deepStrictEqual(placeholders(value), placeholders(template[key]), `${file}: placeholders differ for "${key}"`);
  }
}

describe('localization', () => {
  it('has an up-to-date English template', () => {
    execFileSync(process.execPath, [join(root, 'scripts', 'extract-l10n.mjs'), '--check'], { stdio: 'pipe' });
  });

  it('defines every %key% used in package.json', () => {
    const nls = readJson('package.nls.json');
    const used = readFileSync(join(root, 'package.json'), 'utf8').match(/"%([\w.]+)%"/g) ?? [];
    const undefinedKeys = used.map((k) => k.slice(2, -2)).filter((k) => !(k in nls));
    assert.deepStrictEqual(undefinedKeys, []);
  });

  for (const lang of LANGUAGES) {
    it(`is complete for ${lang}`, () => {
      checkTranslations(readJson('l10n/bundle.l10n.json'), `l10n/bundle.l10n.${lang}.json`);
      checkTranslations(readJson('package.nls.json'), `package.nls.${lang}.json`);
    });
  }
});
