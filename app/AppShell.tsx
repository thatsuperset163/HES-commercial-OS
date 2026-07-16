"use client";



import Image from "next/image";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { type ReactNode } from "react";



const NAV = [

  { href: "/", label: "HQ", match: (path: string) => path === "/" },

  {

    href: "/personal",

    label: "Personal",

    match: (path: string) => path.startsWith("/personal"),

  },

  {

    href: "/work",

    label: "Work",

    match: (path: string) => path.startsWith("/work"),

  },

] as const;



export default function AppShell({ children }: { children: ReactNode }) {

  const pathname = usePathname();



  const current =

    NAV.find((item) => item.match(pathname)) ?? NAV[0];



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

        {NAV.map((item) =>

            <Link

              key={item.href}

              href={item.href}

              className={`hq-nav-link${item.match(pathname) ? " active" : ""}`}

            >

              {item.label}

            </Link>

        )}

        </nav>
        <div className="sidebar-foot">
          <span className="sync-dot" aria-hidden />
          <span>Cloud connected</span>
        </div>
      </aside>

      <section className="shell-main">
        <header className="topbar">
          <div>
            <p className="brand-eyebrow">HES Operating System</p>
            <h2 className="section-heading">{current.label}</h2>
          </div>
          <div className="utility-area">
            <span className="utility-status">
              <span className="sync-dot" aria-hidden />
              Synced
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

