// Pre-rendered glow sprites: `shadowBlur` is paid once per (color, size, blur), not once per frame.
// Only for fixed-size shapes — a size that changes every frame would grow the cache without bound.

export interface GlowCache {
  /** Draws a `color`-filled rect with its same-color glow, from a pre-rendered sprite. */
  rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, blur: number): void;
  /** Drops every sprite: call it on setSkin (colors change) and on destroy. */
  clear(): void;
}

export function createGlowCache(): GlowCache {
  const sprites = new Map<string, HTMLCanvasElement>();

  // The glow fades out within 2·blur of the shape, so that is the sprite's padding on each side.
  function spriteFor(w: number, h: number, color: string, blur: number): HTMLCanvasElement {
    const key = `${color}|${w}|${h}|${blur}`;
    const cached = sprites.get(key);
    if (cached) return cached;
    const pad = blur * 2;
    const sprite = document.createElement("canvas");
    sprite.width = w + pad * 2;
    sprite.height = h + pad * 2;
    const ctx = sprite.getContext("2d");
    if (!ctx) throw new Error("GlowCache: 2D canvas context is not available");
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillRect(pad, pad, w, h);
    sprites.set(key, sprite);
    return sprite;
  }

  return {
    rect(ctx, x, y, w, h, color, blur) {
      if (blur <= 0) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        return;
      }
      const sprite = spriteFor(Math.round(w), Math.round(h), color, blur);
      ctx.drawImage(sprite, x - blur * 2, y - blur * 2);
    },
    clear() {
      sprites.clear();
    },
  };
}
