// Optimistic access rules for proxy.ts (spec 22). Pages, Server Actions and
// RLS still check on their own: the proxy only redirects early.
export type RouteAccess = "protected" | "guest-only" | "public";

// Need a session. Match the path itself and its subtree ("/x", "/x/..."), never "/xy".
export const PROTECTED_PATHS = ["/login/nombre"] as const;

// Only for visitors without a session. Exact match ("/login" must not catch "/login/nombre").
export const GUEST_ONLY_PATHS = ["/login"] as const;

function isInSubtree(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function getRouteAccess(pathname: string): RouteAccess {
  if (PROTECTED_PATHS.some((base) => isInSubtree(pathname, base))) return "protected";
  if (GUEST_ONLY_PATHS.some((path) => path === pathname)) return "guest-only";
  return "public";
}
