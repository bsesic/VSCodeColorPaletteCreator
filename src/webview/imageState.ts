/**
 * Holds the currently loaded image so several views (extraction and color
 * blindness simulation) can use it.
 */
import { ImageData2D } from '../core/extract.js';

export interface LoadedImage {
  name: string;
  /** Downscaled pixel data used for processing. */
  pixels: ImageData2D;
  /** Canvas containing the downscaled image. */
  canvas: HTMLCanvasElement;
}

const MAX_SIDE = 900;
const listeners: Array<(image: LoadedImage) => void> = [];
let current: LoadedImage | undefined;

export function getImage(): LoadedImage | undefined {
  return current;
}

export function onImageLoaded(listener: (image: LoadedImage) => void): void {
  listeners.push(listener);
}

/** Decodes an image from a data/blob URL, downscales it and notifies listeners. */
export function loadImage(src: string, name: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * scale));
      const height = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Canvas is not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const data = ctx.getImageData(0, 0, width, height).data;
      current = { name, canvas, pixels: { data, width, height } };
      listeners.forEach((l) => l(current as LoadedImage));
      resolve(current);
    };
    img.onerror = () => reject(new Error(`Could not load image "${name}"`));
    img.src = src;
  });
}

/** Reads a File (from an input, drop or paste) and loads it. */
export function loadImageFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error(`"${file.name}" is not an image`));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => loadImage(String(reader.result), file.name).then(resolve, reject);
    reader.onerror = () => reject(new Error(`Could not read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}
