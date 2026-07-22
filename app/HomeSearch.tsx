"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { filterOsNav, HOME_QUICK_LINKS, resolveQuickHref } from "@/lib/osNav";
import { todayKey } from "@/lib/dates";
import { groupRecordHits, searchRecords } from "@/lib/home/recordSearch";
import type { IntakeRequest } from "@/lib/requestsCenter/types";

type Props = {
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
};

type FlatHit = {
  key: string;
  href: string;
  label: string;
  detail?: string;
  kind: "os" | "quick" | "record";
  type?: string;
  typeLabel?: string;
};

/**
 * Global search: OS systems, quick links, and Work records.
 * Requests use live intake when available. Sales prospects are not blended in.
 */
export default function HomeSearch({ inputRef, className = "" }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [intake, setIntake] = useState<IntakeRequest[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const localRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const today = todayKey();
  const ref = inputRef ?? localRef;

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query), 160);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/requests", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((res) => res.json())
      .then((json: { ok?: boolean; data?: { requests?: IntakeRequest[] } }) => {
        if (!cancelled && json.ok) setIntake(json.data?.requests ?? []);
      })
      .catch(() => {
        if (!cancelled) setIntake([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const records = searchRecords(debounced, 12, { intakeRequests: intake });
    const recordGroups = groupRecordHits(records);
    return { os, quick, records, recordGroups };
  }, [query, debounced, today, intake]);

  const flat: FlatHit[] = useMemo(() => {
    const rows: FlatHit[] = [];
    for (const item of results.os) {
      rows.push({
        key: `os-${item.id}`,
        href: item.href,
        label: item.label,
        kind: "os",
      });
    }
    for (const group of results.recordGroups) {
      for (const item of group.items) {
        rows.push({
          key: item.id,
          href: item.href,
          label: item.title,
          detail: item.detail,
          kind: "record",
          type: item.type,
          typeLabel: item.typeLabel,
        });
      }
    }
    if (!query.trim()) {
      for (const item of results.quick) {
        rows.push({
          key: `q-${item.id}`,
          href: item.href,
          label: item.label,
          kind: "quick",
        });
      }
    }
    return rows;
  }, [results, query]);

  useEffect(() => {
    setActive(0);
  }, [query, debounced]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const hasQuery = query.trim().length > 0;
  const empty = hasQuery && flat.length === 0;

  const go = (href: string) => {
    setOpen(false);
    window.location.href = href;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      return;
    }
    if (!open || !flat.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = flat[active];
      if (hit) go(hit.href);
    }
  };

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
          onKeyDown={onKeyDown}
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-activedescendant={flat[active] ? `hit-${flat[active].key}` : undefined}
        />
      </label>

      {open ? (
        <div id={listId} className="home-search-panel" role="listbox">
          {!hasQuery ? (
            <p className="home-search-hint">
              Search people, jobs, invoices — or jump to an OS.
            </p>
          ) : null}

          {results.os.length ? (
            <div className="home-search-group">
              <p className="home-search-group-label">Operating systems</p>
              <ul>
                {results.os.map((item) => {
                  const key = `os-${item.id}`;
                  const idx = flat.findIndex((f) => f.key === key);
                  return (
                    <li key={key}>
                      <Link
                        id={`hit-${key}`}
                        href={item.href}
                        className={`home-search-hit${idx === active ? " is-active" : ""}`}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => setOpen(false)}
                      >
                        <strong>{item.label}</strong>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {results.recordGroups.map((group) => (
            <div key={group.type} className="home-search-group">
              <p className="home-search-group-label">{group.typeLabel}</p>
              <ul>
                {group.items.map((item) => {
                  const idx = flat.findIndex((f) => f.key === item.id);
                  return (
                    <li key={item.id}>
                      <Link
                        id={`hit-${item.id}`}
                        href={item.href}
                        className={`home-search-hit is-record${idx === active ? " is-active" : ""}`}
                        data-type={item.type}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => setOpen(false)}
                      >
                        <span className="home-search-type">{item.typeLabel}</span>
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {!hasQuery && results.quick.length ? (
            <div className="home-search-group">
              <p className="home-search-group-label">Quick links</p>
              <ul>
                {results.quick.map((item) => {
                  const key = `q-${item.id}`;
                  const idx = flat.findIndex((f) => f.key === key);
                  return (
                    <li key={key}>
                      <Link
                        id={`hit-${key}`}
                        href={item.href}
                        className={`home-search-hit${idx === active ? " is-active" : ""}`}
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => setOpen(false)}
                      >
                        <strong>{item.label}</strong>
                      </Link>
                    </li>
                  );
                })}
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
