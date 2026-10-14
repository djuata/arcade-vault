"use client";

import { useEffect, useId, useRef, useState } from "react";

interface AccountMenuProps {
  name: string;
  onLogout: () => void;
}

// Desktop/tablet account button: opens a menu, never logs out on its own (spec 19, D13).
// The Nav keys it by pathname, so navigating closes it.
export function AccountMenu({ name, onLogout }: AccountMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="account-menu auth-btn">
      <button
        type="button"
        className="btn ghost"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {name} ▾
      </button>
      {open && (
        <div id={menuId} role="menu" className="account-menu-list">
          <button type="button" role="menuitem" className="btn ghost" onClick={onLogout}>
            CERRAR SESIÓN
          </button>
        </div>
      )}
    </div>
  );
}
