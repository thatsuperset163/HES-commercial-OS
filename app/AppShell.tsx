"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import {
  blackboardCloudStatusLabel,
  getBlackboardCloudStatus,
  hydrateStoreFromCloud,
  subscribeBlackboardCloudStatus,
  type BlackboardCloudStatus,
} from "@/lib/storage";

const NAV = [
  { href: "/", label: "HQ", icon: "H", match: (path: string) => path === "/" },
  {
    href: "/work",
    label: "Work",
    icon: "W",
    match: (path: string) => path.startsWith("/work"),
  },
] as const;

function syncDotClass(status: BlackboardCloudStatus): string {
  if (status === "synced") return "sync-dot";
  if (status === "saving" || status === "loading") return "sync-dot is-warn";
  return "sync-dot is-danger";
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [cloudStatus, setCloudStatus] = useState<BlackboardCloudStatus>(
    getBlackboardCloudStatus,
  );

  const current = NAV.find((item) => item.match(pathname)) ?? NAV[0];
  const statusLabel = blackboardCloudStatusLabel(cloudStatus);

  useEffect(() => {
    const unsub = subscribeBlackboardCloudStatus(setCloudStatus);
    void hydrateStoreFromCloud();
    return unsub;
  }, []);

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <main className="app-shell">
      <aside className="shell-sidebar">
        <div className="brand-lockup">
          <Image
            className="brand-logo"
            src="/hes-logo.png"
            alt="Harris Exterior Solutions"
            width={144}
            height={144}
            priority
          />
          <div className="brand-block">
            <p className="brand-eyebrow">Harris Exterior</p>
            <h1 className="brand-title">HES OS</h1>
          </div>
        </div>
        <nav className="hq-nav" aria-label="Sections">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`hq-nav-link${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="hq-nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot" title={statusLabel}>
          <span className={syncDotClass(cloudStatus)} aria-hidden />
          <span>{statusLabel}</span>
        </div>
      </aside>

      <section className="shell-main">
        <header className="topbar">
          <div>
            <p className="brand-eyebrow">HES Operating System</p>
            <h2 className="section-heading">{current.label}</h2>
          </div>
          <div className="utility-area">
            <span className="utility-status" title={statusLabel}>
              <span className={syncDotClass(cloudStatus)} aria-hidden />
              {statusLabel}
            </span>
            <button type="button" className="icon-btn" onClick={logout}>
              Lock
            </button>
          </div>
        </header>
        <div className="shell-content">{children}</div>
      </section>
    </main>
  );
}
