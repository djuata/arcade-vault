"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session-context";

const PANEL_ID = "av-mobile-panel";

export function Nav() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const isHomeActive = pathname === "/";
  const isLibraryActive = pathname === "/games" || pathname.startsWith("/games/");
  const isHallActive = pathname === "/hall-of-fame";
  const isAboutActive = pathname === "/about";
  const isLoginActive = pathname === "/login";

  const close = () => setOpen(false);

  // While the panel is open: focus its first link and close on Escape.
  // On close, focus goes back to the hamburger.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const hamburger = hamburgerRef.current;
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      hamburger?.focus();
    };
  }, [open]);

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
          <Link href="/" className={isHomeActive ? "active" : ""}>
            Inicio
          </Link>
          <Link href="/games" className={isLibraryActive ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/hall-of-fame" className={isHallActive ? "active" : ""}>
            Salón de la Fama
          </Link>
          <Link href="/about" className={isAboutActive ? "active" : ""}>
            Acerca de
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
        <button
          ref={hamburgerRef}
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
          aria-controls={PANEL_ID}
        >
          ≡
        </button>
      </nav>

      <div className={`av-mobile-backdrop${open ? " open" : ""}`} onClick={close} />
      <aside
        ref={panelRef}
        id={PANEL_ID}
        aria-label="Menú"
        inert={!open}
        className={`av-mobile-panel${open ? " open" : ""}`}
      >
        <div className="pixel neon-cyan av-mobile-panel-title">MENÚ</div>
        <button className="av-mobile-panel-close" onClick={close} aria-label="Cerrar menú">
          ✕
        </button>
        <Link href="/" className={isHomeActive ? "active" : ""} onClick={close}>
          Inicio
        </Link>
        <Link href="/games" className={isLibraryActive ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/hall-of-fame" className={isHallActive ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/about" className={isAboutActive ? "active" : ""} onClick={close}>
          Acerca de
        </Link>
        <Link href="/login" className={isLoginActive ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        {user && (
          <button
            className="btn ghost"
            onClick={() => {
              logout();
              close();
            }}
          >
            {user.name} ▾
          </button>
        )}
        <div style={{ flex: 1 }} />
        <div className="pixel av-mobile-panel-credits">CRÉDITOS · 03</div>
      </aside>
    </>
  );
}
