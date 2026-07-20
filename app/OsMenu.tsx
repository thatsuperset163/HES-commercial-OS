"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { OS_NAV_ITEMS } from "@/lib/osNav";

type Props = {
  className?: string;
};

/** Three-line menu listing every live OS / desk. */
export default function OsMenu({ className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const items = OS_NAV_ITEMS.filter((item) => item.id !== "home");

  return (
    <div className={`os-menu ${className}${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="os-menu-trigger"
        aria-label="Open operating systems menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="os-menu-lines" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>

      {open ? (
        <div id={menuId} className="os-menu-panel" role="menu" aria-label="Operating systems">
          <p className="os-menu-heading">Operating systems</p>
          <ul className="os-menu-list">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  role="menuitem"
                  className="os-menu-item"
                  onClick={() => setOpen(false)}
                >
                  <strong>{item.label}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
