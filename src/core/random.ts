/** Small seedable pseudo random number generator (mulberry32). */
export type Rng = () => number;

export function createRng(seed: number = Date.now()): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createId(rng: Rng = Math.random): string {
  return Math.floor(rng() * 0xffffffff).toString(36) + Date.now().toString(36);
}
