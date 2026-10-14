"use client";

import { useActionState } from "react";
import { chooseUsername } from "@/app/login/nombre/actions";
import type { AuthFormState } from "@/app/login/actions";
import { useSession } from "@/lib/session-context";

const INITIAL_STATE: AuthFormState = { error: null };

export function ChooseUsername({ suggestion }: { suggestion: string }) {
  const { logout } = useSession();
  const [state, action, pending] = useActionState(chooseUsername, INITIAL_STATE);

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ELIGE TU NOMBRE</h2>
          <div className="mono auth-sub">ASÍ TE VERÁN EN LOS RANKINGS. NO SE PUEDE CAMBIAR DESPUÉS.</div>
        </div>

        <form action={action}>
          <div className="field">
            <label htmlFor="choose-username">Nombre de jugador</label>
            <input
              id="choose-username"
              name="username"
              autoComplete="username"
              required
              minLength={3}
              maxLength={10}
              defaultValue={suggestion}
              placeholder="PX_KAI"
            />
          </div>
          {state.error && (
            <p className="save-error" role="alert">
              {state.error}
            </p>
          )}
          <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%", marginTop: 8 }}>
            {pending ? "GUARDANDO..." : "CONFIRMAR NOMBRE"}
          </button>
        </form>

        <button type="button" className="btn ghost" onClick={logout} style={{ width: "100%", marginTop: 10 }}>
          CERRAR SESIÓN
        </button>
      </div>
    </div>
  );
}
