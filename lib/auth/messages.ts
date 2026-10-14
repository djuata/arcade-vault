// User-facing auth errors (spec 19). Never show Supabase's raw message.
export const AUTH_MESSAGES = {
  invalidCredentials: "CORREO O CONTRASEÑA INCORRECTOS",
  invalidUsername: "NOMBRE: 3 A 10 LETRAS, NÚMEROS O _",
  usernameTaken: "ESE NOMBRE YA ESTÁ EN USO",
  emailTaken: "ESE CORREO YA TIENE UNA CUENTA",
  passwordRules: "MÍNIMO 8 CARACTERES CON MAYÚSCULA, MINÚSCULA, NÚMERO Y SÍMBOLO",
  generic: "NO PUDIMOS CONECTAR CON EL VAULT. INTENTA DE NUEVO",
  nameBelongsToPlayer: "ESE NOMBRE PERTENECE A UN JUGADOR REGISTRADO",
  oauthFailed: "NO PUDIMOS CONECTAR CON EL PROVEEDOR. INTENTA DE NUEVO",
} as const;
