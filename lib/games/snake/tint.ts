import type { SpriteTint } from "./skins";

/**
 * Returns an offscreen copy of `image` with `tint` painted over its opaque pixels
 * only (`source-atop`), so each sprite keeps its transparency. Always tints from
 * the original image: callers cache the result per skin to never stack tints.
 */
export function tintSheet(image: HTMLImageElement, tint: SpriteTint): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Snake: 2D canvas context is not available for tinting");
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha = tint.alpha;
  ctx.fillStyle = tint.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  return canvas;
}
