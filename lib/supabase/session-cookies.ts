// HttpOnly: the session token is never readable from JS. Everything that needs
// the session (auth actions, saveScore, layout) runs on the server (spec 19, D17).
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;
