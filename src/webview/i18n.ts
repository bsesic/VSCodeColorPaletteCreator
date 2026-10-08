/**
 * Localization for the webview. The extension host embeds the l10n bundle
 * of the VS Code display language as JSON into the page; English needs no
 * bundle because the English text is the key.
 */
import { describeColorParts } from '../core/color.js';

function readBundle(): Record<string, string> {
  try {
    const el = document.getElementById('l10n-bundle');
    return el?.textContent ? (JSON.parse(el.textContent) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const bundle = readBundle();

/** Translates `message` and replaces {0}, {1}, ... with `args`. */
export function t(message: string, ...args: Array<string | number>): string {
  const text = bundle[message] ?? message;
  return args.length === 0 ? text : text.replace(/\{(\d+)\}/g, (match, i: string) => {
    const value = args[Number(i)];
    return value === undefined ? match : String(value);
  });
}

/** Localized human readable color name, e.g. "Dark Blue". */
export function colorName(hex: string): string {
  const { tone, hue } = describeColorParts(hex);
  const name = t(hue);
  if (tone === 'dark') {
    return t('Dark {0}', name);
  }
  return tone === 'light' ? t('Light {0}', name) : name;
}
