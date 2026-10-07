// Skins are canvas-only palettes. Every playable game must ship at least these.
export const REQUIRED_SKINS = ["classic", "neon", "retro"] as const;

export type SkinId = (typeof REQUIRED_SKINS)[number];

export const DEFAULT_SKIN: SkinId = "classic";

/** Each game defines its own palette shape; extra skins beyond the required ones are allowed. */
export type GameSkins<Palette> = Readonly<Record<SkinId, Palette>> &
  Readonly<Record<string, Palette>>;

export function resolveSkin<Palette>(skins: GameSkins<Palette>, id?: string): Palette {
  return id && Object.hasOwn(skins, id) ? skins[id] : skins[DEFAULT_SKIN];
}

// ── Labels ──────────────────────────────────────────────────────────────────

export const SKIN_LABELS: Readonly<Record<SkinId, string>> = {
  classic: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

function isRequiredSkin(id: string): id is SkinId {
  return (REQUIRED_SKINS as readonly string[]).includes(id);
}

export function skinLabel(id: string): string {
  return isRequiredSkin(id) ? SKIN_LABELS[id] : id.toUpperCase();
}

// ── Browser preference (per game) ───────────────────────────────────────────

export function skinStorageKey(slug: string): string {
  return `av_skin_${slug}`;
}

export function readStoredSkin(slug: string, available: readonly string[]): string {
  try {
    const stored = localStorage.getItem(skinStorageKey(slug));
    return stored !== null && available.includes(stored) ? stored : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function storeSkin(slug: string, id: string): void {
  try {
    localStorage.setItem(skinStorageKey(slug), id);
  } catch {
    // localStorage disabled (private mode) — the choice simply doesn't persist.
  }
}
