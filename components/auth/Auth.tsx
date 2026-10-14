"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signInWithOAuth, signUp, type AuthFormState } from "@/app/login/actions";
import { AUTH_MESSAGES } from "@/lib/auth/messages";

type Tab = "in" | "up";

const INITIAL_STATE: AuthFormState = { error: null };

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="save-error" role="alert">
      {message}
    </p>
  );
}

function SignInForm() {
  const [state, action, pending] = useActionState(signIn, INITIAL_STATE);
  return (
    <form action={action}>
      <div className="field">
        <label htmlFor="signin-email">Correo electrónico</label>
        <input id="signin-email" name="email" type="email" autoComplete="email" required placeholder="jugador@vault.gg" />
      </div>
      <div className="field">
        <label htmlFor="signin-password">Contraseña</label>
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </div>
      <FormError message={state.error} />
      <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%", marginTop: 8 }}>
        {pending ? "CONECTANDO..." : "ENTRAR AL VAULT"}
      </button>
    </form>
  );
}

function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, INITIAL_STATE);
  return (
    <form action={action} className="slide-in">
      <div className="field">
        <label htmlFor="signup-username">Nombre de jugador</label>
        <input
          id="signup-username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={10}
          placeholder="PX_KAI"
        />
      </div>
      <div className="field">
        <label htmlFor="signup-email">Correo electrónico</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" required placeholder="jugador@vault.gg" />
      </div>
      <div className="field">
        <label htmlFor="signup-password">Contraseña</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </div>
      <FormError message={state.error} />
      <button className="btn lg" type="submit" disabled={pending} style={{ width: "100%", marginTop: 8 }}>
        {pending ? "CREANDO CUENTA..." : "CREAR Y JUGAR"}
      </button>
    </form>
  );
}

// Same buttons for both tabs: with OAuth, signing in and signing up are one step (spec 20, D8).
function OAuthButtons() {
  return (
    <>
      <div className="auth-divider">O CONTINÚA CON</div>
      <form action={signInWithOAuth} className="social">
        <button className="btn ghost" type="submit" name="provider" value="google">
          ◆ GOOGLE
        </button>
        <button className="btn ghost" type="submit" name="provider" value="github">
          ◆ GITHUB
        </button>
      </form>
    </>
  );
}

export function Auth({ oauthError = false }: { oauthError?: boolean }) {
  const [tab, setTab] = useState<Tab>("in");

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono auth-sub">ACCESO AL SISTEMA · v2.6</div>
        </div>

        <div className="auth-tabs">
          <button type="button" className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>
            INICIAR SESIÓN
          </button>
          <button type="button" className={tab === "up" ? "on" : ""} onClick={() => setTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        <FormError message={oauthError ? AUTH_MESSAGES.oauthFailed : null} />
        {tab === "in" ? <SignInForm /> : <SignUpForm />}
        <OAuthButtons />

        <Link href="/games" className="btn ghost" style={{ width: "100%", marginTop: 10 }}>
          JUGAR COMO INVITADO
        </Link>

        <div className="auth-terms">AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE</div>
      </div>
    </div>
  );
}
