"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { filterOsNav, HOME_QUICK_LINKS, resolveQuickHref } from "@/lib/osNav";
import { todayKey } from "@/lib/dates";

type Props = {
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

/**
 * Always-visible search. Type to filter OS systems and quick links.
 * No modifier key required — just click or start typing on the home page.
 */
export default function HomeSearch({ inputRef, className = "" }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const today = todayKey();

  const ref = inputRef ?? localRef;

  const results = useMemo(() => {
    const os = filterOsNav(query);
    const q = query.trim().toLowerCase();
    const quick = HOME_QUICK_LINKS.filter((link) => {
      if (!q) return true;
      return `${link.label} ${link.description}`.toLowerCase().includes(q);
    }).map((link) => ({
      ...link,
      href: resolveQuickHref(link.href, today),
    }));
    return { os, quick };
  }, [query, today]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hasQuery = query.trim().length > 0;
  const empty =
    hasQuery && results.os.length === 0 && results.quick.length === 0;

  return (
    <div className={`home-search ${className}`} ref={rootRef}>
      <label className="home-search-label" htmlFor="hes-home-search">
        <span className="sr-only">Search</span>
        <input
          id="hes-home-search"
          ref={ref}
          type="search"
          className="home-search-input"
          placeholder="Search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
        />
      </label>

      {open ? (
        <div id={listId} className="home-search-panel" role="listbox">
          {!hasQuery ? (
            <p className="home-search-hint">
              Type to find Jobs, Requests, Sales, and more — no shortcut key needed.
            </p>
          ) : null}

          {results.os.length ? (
            <div className="home-search-group">
              <p className="home-search-group-label">Operating systems</p>
              <ul>
                {results.os.map((item) => (
                  <li key={`os-${item.id}`}>
                    <Link
                      href={item.href}
                      className="home-search-hit"
                      role="option"
                      onClick={() => setOpen(false)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {results.quick.length ? (
            <div className="home-search-group">
              <p className="home-search-group-label">Quick links</p>
              <ul>
                {results.quick.map((item) => (
                  <li key={`q-${item.id}`}>
                    <Link
                      href={item.href}
                      className="home-search-hit"
                      role="option"
                      onClick={() => setOpen(false)}
                    >
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {empty ? (
            <p className="home-search-empty">No matches for “{query.trim()}”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
