import { h } from './dom.js';

let container: HTMLElement | undefined;

/** Shows a short, non-blocking notification inside the webview. */
export function toast(message: string, swatch?: string): void {
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(container);
  }
  const el = h('div', { class: 'toast' },
    swatch ? h('span', { class: 'toast-swatch', style: `background:${swatch}` }) : null,
    message);
  container.appendChild(el);
  setTimeout(() => el.classList.add('hide'), 1600);
  setTimeout(() => el.remove(), 2000);
}
