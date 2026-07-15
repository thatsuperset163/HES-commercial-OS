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

  {

    href: "/sales/",

    label: "Sales",

    match: (path: string) => path.startsWith("/sales"),

    external: true,

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

      <header className="topbar">

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

            <p className="brand-eyebrow">Harris Exterior Solutions</p>

            <h1 className="brand-title">{current.label}</h1>

            <p className="brand-sub">Portal · Blackboard · Sales OS</p>

          </div>

        </div>

        <button type="button" className="icon-btn" onClick={logout}>

          Lock

        </button>

      </header>



      <nav className="hq-nav" aria-label="Sections">

        {NAV.map((item) =>

          "external" in item && item.external ? (

            <a

              key={item.href}

              href={item.href}

              className={`hq-nav-link${item.match(pathname) ? " active" : ""}`}

            >

              {item.label}

            </a>

          ) : (

            <Link

              key={item.href}

              href={item.href}

              className={`hq-nav-link${item.match(pathname) ? " active" : ""}`}

            >

              {item.label}

            </Link>

          ),

        )}

      </nav>



      {children}

    </main>

  );

}

