import { EXPLOSION_DURATION, EXPLOSION_FRAME_COUNT, H, W } from "./constants";
import type { Ball, Block, Explosion, Rect } from "./entities";
import { EXPLOSION_FRAMES, FALLBACK_COLORS, SPRITES, type Sprite } from "./sprites";

export interface Frame {
  blocks: readonly Block[];
  explosions: readonly Explosion[];
  paddle: Rect;
  ball: Ball;
  /** `null` while the spritesheet loads (or if it failed): flat colors are drawn instead. */
  sheet: HTMLImageElement | null;
}

function drawSprite(ctx: CanvasRenderingContext2D, sheet: HTMLImageElement, sprite: Sprite, rect: Rect) {
  ctx.drawImage(sheet, sprite.sx, sprite.sy, sprite.sw, sprite.sh, rect.x, rect.y, rect.w, rect.h);
}

function drawFlat(ctx: CanvasRenderingContext2D, color: string, rect: Rect) {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

// Only the game: HUD, pause and game over belong to the platform.
export function drawFrame(ctx: CanvasRenderingContext2D, { blocks, explosions, paddle, ball, sheet }: Frame) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  for (const block of blocks) {
    if (!block.alive) continue;
    if (sheet) drawSprite(ctx, sheet, SPRITES.blocks[block.color], block);
    else drawFlat(ctx, FALLBACK_COLORS.blocks[block.color], block);
  }

  // Explosions are a sprite animation; without the spritesheet they are skipped.
  if (sheet) {
    for (const explosion of explosions) {
      const index = Math.min(
        Math.floor((explosion.elapsed / EXPLOSION_DURATION) * EXPLOSION_FRAME_COUNT),
        EXPLOSION_FRAME_COUNT - 1,
      );
      drawSprite(ctx, sheet, EXPLOSION_FRAMES[explosion.color][index], explosion);
    }
  }

  if (sheet) {
    drawSprite(ctx, sheet, SPRITES.paddle, paddle);
    drawSprite(ctx, sheet, SPRITES.ball, ball);
  } else {
    drawFlat(ctx, FALLBACK_COLORS.paddle, paddle);
    drawFlat(ctx, FALLBACK_COLORS.ball, ball);
  }
}
