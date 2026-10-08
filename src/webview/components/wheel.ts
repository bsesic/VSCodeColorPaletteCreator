/**
 * Interactive HSV color wheel. Hue is the angle (0° at the top, clockwise),
 * saturation the distance from the center. Palette colors are shown as
 * draggable markers.
 */
import { clamp, hexToHsv, hsvToRgb, wrapHue } from '../../core/color.js';
import { h } from '../dom.js';

export interface WheelOptions {
  onDragStart?: (index: number) => void;
  onDrag: (index: number, hue: number, saturation: number) => void;
  onDragEnd?: (index: number) => void;
  onSelect?: (index: number) => void;
}

const SIZE = 280;
const MARGIN = 12;

export class ColorWheel {
  readonly element: HTMLElement;
  private readonly wheel: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private colors: string[] = [];
  private baseIndex = 0;
  private selected = 0;
  private brightness = -1;
  private dragging = -1;

  constructor(private readonly options: WheelOptions) {
    const ratio = window.devicePixelRatio || 1;
    this.wheel = h('canvas', { width: SIZE * ratio, height: SIZE * ratio, class: 'wheel-canvas' });
    this.overlay = h('canvas', {
      width: SIZE * ratio, height: SIZE * ratio, class: 'wheel-overlay', tabindex: 0,
      role: 'img', 'aria-label': 'Color wheel with palette markers'
    });
    this.element = h('div', { class: 'wheel', style: `width:${SIZE}px;height:${SIZE}px` }, this.wheel, this.overlay);
    this.bind();
  }

  private get radius(): number {
    return SIZE / 2 - MARGIN;
  }

  update(colors: string[], baseIndex: number, selected: number, brightness: number): void {
    this.colors = colors;
    this.baseIndex = baseIndex;
    this.selected = selected;
    if (Math.round(brightness) !== Math.round(this.brightness)) {
      this.brightness = brightness;
      this.drawWheel();
    }
    this.drawMarkers();
  }

  private drawWheel(): void {
    const ctx = this.wheel.getContext('2d');
    if (!ctx) { return; }
    const size = this.wheel.width;
    const ratio = size / SIZE;
    const img = ctx.createImageData(size, size);
    const c = size / 2;
    const r = this.radius * ratio;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 1) { continue; }
        const hue = wrapHue((Math.atan2(dy, dx) * 180) / Math.PI + 90);
        const rgb = hsvToRgb({ h: hue, s: clamp(d / r, 0, 1) * 100, v: this.brightness });
        const i = (y * size + x) * 4;
        img.data[i] = rgb.r;
        img.data[i + 1] = rgb.g;
        img.data[i + 2] = rgb.b;
        img.data[i + 3] = d > r ? Math.round((r + 1 - d) * 255) : 255; // Anti-aliased edge.
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private position(hex: string): { x: number; y: number } {
    const { h: hue, s } = hexToHsv(hex);
    const angle = ((hue - 90) * Math.PI) / 180;
    const d = (s / 100) * this.radius;
    return { x: SIZE / 2 + Math.cos(angle) * d, y: SIZE / 2 + Math.sin(angle) * d };
  }

  private drawMarkers(): void {
    const ctx = this.overlay.getContext('2d');
    if (!ctx) { return; }
    const ratio = this.overlay.width / SIZE;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);
    const center = SIZE / 2;
    const points = this.colors.map((c) => this.position(c));

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    points.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });

    points.forEach((p, i) => {
      const isBase = i === this.baseIndex;
      const size = isBase ? 11 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this.colors[i];
      ctx.fill();
      ctx.lineWidth = i === this.selected ? 3 : 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, size + (i === this.selected ? 2 : 1.5), 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  private hitTest(x: number, y: number): number {
    let best = -1;
    let bestD = 18;
    // Iterate backwards so the top-most marker wins; prefer the base marker on ties.
    for (let i = this.colors.length - 1; i >= 0; i--) {
      const p = this.position(this.colors[i]);
      const d = Math.hypot(p.x - x, p.y - y) - (i === this.baseIndex ? 3 : 0);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private toHueSat(x: number, y: number): [number, number] {
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const hue = wrapHue((Math.atan2(dy, dx) * 180) / Math.PI + 90);
    const sat = clamp(Math.hypot(dx, dy) / this.radius, 0, 1) * 100;
    return [hue, sat];
  }

  private bind(): void {
    const local = (e: PointerEvent): [number, number] => {
      const rect = this.overlay.getBoundingClientRect();
      return [((e.clientX - rect.left) / rect.width) * SIZE, ((e.clientY - rect.top) / rect.height) * SIZE];
    };
    this.overlay.addEventListener('pointerdown', (e) => {
      const [x, y] = local(e);
      let index = this.hitTest(x, y);
      if (index < 0) {
        // Clicking on an empty spot moves the selected marker there.
        index = this.selected;
      }
      this.dragging = index;
      this.overlay.setPointerCapture(e.pointerId);
      this.options.onSelect?.(index);
      this.options.onDragStart?.(index);
      const [hue, sat] = this.toHueSat(x, y);
      this.options.onDrag(index, hue, sat);
    });
    this.overlay.addEventListener('pointermove', (e) => {
      const [x, y] = local(e);
      if (this.dragging < 0) {
        this.overlay.style.cursor = this.hitTest(x, y) >= 0 ? 'grab' : 'crosshair';
        return;
      }
      const [hue, sat] = this.toHueSat(x, y);
      this.options.onDrag(this.dragging, hue, sat);
    });
    const end = (): void => {
      if (this.dragging >= 0) {
        this.options.onDragEnd?.(this.dragging);
      }
      this.dragging = -1;
    };
    this.overlay.addEventListener('pointerup', end);
    this.overlay.addEventListener('pointercancel', end);
  }
}
