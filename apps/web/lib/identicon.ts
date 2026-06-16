// Deterministic, on-brand player avatars — no external service, no deps.
// A jazzicon-style identicon: a seeded base color + a few rotated geometric
// marks, all derived from the address so the same wallet always renders the
// same avatar across the app. Hues are free (uniqueness) but saturation and
// lightness are clamped to a premium "jewel tone" range to stay on-brand.

const SHAPES = 3;

/** Cheap, stable 32-bit hash of a string (xxhash-ish). */
function seedFromAddress(addr: string): number {
  let h = 1779033703 ^ addr.length;
  for (let i = 0; i < addr.length; i++) {
    h = Math.imul(h ^ addr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — small, fast, deterministic. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type IdenticonShape = { color: string; x: number; y: number; rot: number; scale: number };
export type Identicon = { bg: string; shapes: IdenticonShape[] };

/** Build the avatar description for an address. Pure + deterministic. */
export function identicon(address: string): Identicon {
  const rnd = mulberry32(seedFromAddress(address.toLowerCase()));
  const baseHue = Math.floor(rnd() * 360);
  const wobble = 36;
  const color = (i: number) => {
    const hue = Math.round((baseHue + (i * 360) / (SHAPES + 1) + (rnd() * wobble - wobble / 2) + 360) % 360);
    const sat = Math.round(56 + rnd() * 18); // 56–74%
    const light = Math.round(46 + rnd() * 16); // 46–62%
    return `hsl(${hue} ${sat}% ${light}%)`;
  };

  const bg = color(0);
  const shapes: IdenticonShape[] = Array.from({ length: SHAPES }, (_, i) => ({
    color: color(i + 1),
    x: rnd() * 100 - 25,
    y: rnd() * 100 - 25,
    rot: Math.round(rnd() * 360),
    scale: 0.5 + rnd() * 0.7,
  }));

  return { bg, shapes };
}
