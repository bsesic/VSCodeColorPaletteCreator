/**
 * Minimal DOM helpers and inline SVG icons.
 */
type Attrs = Record<string, string | number | boolean | EventListener | undefined>;
type Child = Node | string | null | undefined | false;

/** Creates an element: h('button', { class: 'x', onclick: fn }, 'Label'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) {
      continue;
    }
    if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value);
    } else if (key === 'html') {
      el.innerHTML = String(value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, ...children);
  return el;
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }
    parent.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}

export function clear(el: Element): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/** Creates an icon button with a tooltip. */
export function iconButton(icon: string, title: string, onclick: (e: MouseEvent) => void, extraClass = ''): HTMLButtonElement {
  return h('button', {
    class: `icon-btn ${extraClass}`.trim(),
    title,
    'aria-label': title,
    type: 'button',
    html: icon,
    onclick: onclick as EventListener
  });
}

/** Labeled select box. */
export function select<T extends string>(
  options: Array<{ id: T; label: string }>,
  value: T,
  onchange: (value: T) => void,
  title = ''
): HTMLSelectElement {
  const el = h('select', { title, 'aria-label': title });
  options.forEach((o) => append(el, h('option', { value: o.id, selected: o.id === value }, o.label)));
  el.addEventListener('change', () => onchange(el.value as T));
  return el;
}

const svg = (path: string): string =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">${path}</svg>`;

export const ICONS = {
  lock: svg('<path fill="currentColor" d="M4 7V5a4 4 0 1 1 8 0v2h1v8H3V7h1zm2 0h4V5a2 2 0 1 0-4 0v2z"/>'),
  unlock: svg('<path fill="currentColor" d="M6 7h7v8H3V7h1V5a4 4 0 0 1 7.7-1.5l-1.8.8A2 2 0 0 0 6 5v2z"/>'),
  star: svg('<path fill="currentColor" d="M8 1l2.2 4.6 5 .7-3.6 3.5.9 5L8 12.4 3.5 14.8l.9-5L.8 6.3l5-.7z"/>'),
  starOutline: svg('<path fill="none" stroke="currentColor" stroke-width="1.3" d="M8 2.4l1.8 3.8 4.1.6-3 2.9.7 4.1L8 11.8l-3.6 2 .7-4.1-3-2.9 4.1-.6z"/>'),
  copy: svg('<path fill="currentColor" d="M5 1h8a1 1 0 0 1 1 1v9h-2V3H5V1zM2 4h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v7h6V6H3z"/>'),
  trash: svg('<path fill="currentColor" d="M6 1h4l1 1h3v2H2V2h3l1-1zM3 5h10l-1 10H4L3 5z"/>'),
  plus: svg('<path fill="currentColor" d="M7 2h2v5h5v2H9v5H7V9H2V7h5z"/>'),
  drag: svg('<path fill="currentColor" d="M5 3h2v2H5zm4 0h2v2H9zM5 7h2v2H5zm4 0h2v2H9zm-4 4h2v2H5zm4 0h2v2H9z"/>'),
  tint: svg('<path fill="currentColor" d="M8 1s5 5.6 5 9a5 5 0 0 1-10 0c0-3.4 5-9 5-9zm0 3.2C6.4 6.3 5 8.6 5 10a3 3 0 0 0 3 3V4.2z"/>'),
  pipette: svg('<path fill="currentColor" d="M13.3 1.3a2.4 2.4 0 0 1 0 3.4l-1.6 1.6.9.9-1.4 1.4-.9-.9-5.2 5.2H3l-1.6 1.6-.8-.8L2.2 12v-2.1l5.2-5.2-.9-.9 1.4-1.4.9.9 1.6-1.6a2.4 2.4 0 0 1 3.4 0zM8.8 6.1 3.6 11.3v1.1h1.1L9.9 7.2 8.8 6.1z"/>'),
  undo: svg('<path fill="currentColor" d="M5 3 1 7l4 4V8h5a3 3 0 0 1 0 6H8v2h2a5 5 0 0 0 0-10H5V3z"/>'),
  redo: svg('<path fill="currentColor" d="M11 3l4 4-4 4V8H6a3 3 0 0 0 0 6h2v2H6A5 5 0 0 1 6 6h5V3z"/>'),
  refresh: svg('<path fill="currentColor" d="M13.6 6A6 6 0 1 0 14 8h-2a4 4 0 1 1-1.2-2.8L9 7h5V2l-1.8 1.8A6 6 0 0 1 13.6 6z"/>'),
  close: svg('<path fill="currentColor" d="M3.4 2 8 6.6 12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z"/>'),
  edit: svg('<path fill="currentColor" d="M11.5 1.5l3 3L5 14H2v-3l9.5-9.5zm0 2.8L4 11.8V12h.2l7.5-7.5-.2-.2z"/>'),
  download: svg('<path fill="currentColor" d="M7 1h2v7l2.5-2.5L13 7l-5 5-5-5 1.5-1.5L7 8V1zM2 13h12v2H2z"/>'),
  image: svg('<path fill="currentColor" d="M1 2h14v12H1V2zm2 2v7l3-3 2 2 3-4 2 3V4H3zm2.5 1a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"/>'),
  insert: svg('<path fill="currentColor" d="M5 4 1 8l4 4 1.4-1.4L3.8 8l2.6-2.6zm6 0-1.4 1.4L12.2 8l-2.6 2.6L11 12l4-4z"/>'),
  save: svg('<path fill="currentColor" d="M2 1h10l3 3v11H1V1h1zm2 1v4h7V2H4zm4 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>')
};
