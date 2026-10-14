import { RESERVED_USERNAME } from "./schemas";

function pickRawName(metadata: Record<string, unknown>): string | null {
  // GitHub sends its login as `user_name`; Google only gives us the email.
  if (typeof metadata.user_name === "string") return metadata.user_name;
  if (typeof metadata.email === "string") return metadata.email.split("@")[0];
  return null;
}

// Username suggestion for /login/nombre (spec 20, D7): uppercase, only
// A–Z 0–9 _, max 10. Null when nothing usable is left.
export function suggestUsername(metadata: Record<string, unknown>): string | null {
  const raw = pickRawName(metadata);
  if (!raw) return null;

  const name = raw.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 10);
  return name.length >= 3 && name !== RESERVED_USERNAME ? name : null;
}
