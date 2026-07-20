"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  blackboardCloudStatusLabel,
  getBlackboardCloudStatus,
  hydrateStoreFromCloud,
  subscribeBlackboardCloudStatus,
  type BlackboardCloudStatus,
} from "@/lib/storage";
import HomeSearch from "./HomeSearch";
import OsMenu from "./OsMenu";
import "./home-shell.css";

function syncDotClass(status: BlackboardCloudStatus): string {
  if (status === "synced") return "sync-dot";
  if (status === "saving" || status === "loading") return "sync-dot is-warn";
  return "sync-dot is-danger";
}

function sectionTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  if (pathname.startsWith("/work/jobs")) return "Jobs OS";
  if (pathname.startsWith("/work/requests")) return "Requests";
  if (pathname.startsWith("/work/sales")) return "Sales OS";
  if (pathname.startsWith("/work/clients")) return "Clients";
  if (pathname.startsWith("/work/quotes")) return "Quotes";
  if (pathname.startsWith("/work/invoices")) return "Invoices";
  if (pathname.startsWith("/work/tasks")) return "Tasks";
  if (pathname.startsWith("/work/expenses")) return "Expenses";
  if (pathname.startsWith("/work")) return "Home";
  return "HES OS";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [cloudStatus, setCloudStatus] = useState<BlackboardCloudStatus>(
    getBlackboardCloudStatus,
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const statusLabel = blackboardCloudStatusLabel(cloudStatus);
  const isHome = pathname === "/";

  useEffect(() => {
    const unsub = subscribeBlackboardCloudStatus(setCloudStatus);
    void hydrateStoreFromCloud();
    return unsub;
  }, []);

  // On home, printable keys focus search — no Shift/Cmd required.
  useEffect(() => {
    if (!isHome) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key.length === 1) {
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHome]);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="app-shell home-shell">
      <header className="home-topbar">
        <div className="home-topbar-left">
          <OsMenu />
          <Link href="/" className="home-brand" aria-label="HES OS home">
            <Image
              className="home-brand-logo"
              src="/hes-logo.png"
              alt=""
              width={40}
              height={40}
              priority
            />
            <span className="home-brand-text">
              <span className="brand-eyebrow">Harris Exterior</span>
              <strong>HES OS</strong>
            </span>
          </Link>
        </div>

        <HomeSearch inputRef={searchRef} className="home-topbar-search" />

        <div className="home-topbar-right">
          <span className="utility-status" title={statusLabel}>
            <span className={syncDotClass(cloudStatus)} aria-hidden />
            <span className="utility-status-label">{statusLabel}</span>
          </span>
          {!isHome ? (
            <span className="home-section-chip is-visible">
              {sectionTitle(pathname)}
            </span>
          ) : null}
          <button type="button" className="icon-btn" onClick={logout}>
            Lock
          </button>
        </div>
      </header>

      <div className="shell-content home-shell-content">{children}</div>
    </main>
  );
}
