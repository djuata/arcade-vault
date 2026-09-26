"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "@/lib/session-context";

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);

  const isLibraryActive = pathname === "/" || pathname.startsWith("/games/");
  const isHallActive = pathname === "/hall-of-fame";
  const isLoginActive = pathname === "/login";

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isLibraryActive ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isHallActive ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={logout}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div className={`av-mobile-backdrop${open ? " open" : ""}`} onClick={close} />
      <aside className={`av-mobile-panel${open ? " open" : ""}`}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isLibraryActive ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/hall-of-fame" className={isHallActive ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/login" className={isLoginActive ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div className="pixel" style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}>
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
