"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupClientsAlphabetically,
  matchesClientQuery,
} from "@/lib/clients/display";
import { createClient, advanceClientStatus } from "@/lib/work/model";
import type { WorkClient } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  listClients,
  listInvoices,
  listJobs,
  listQuotes,
  listRequests,
  listTasks,
  upsertClient,
} from "@/lib/storage";
import AppShell from "./AppShell";
import AlphabetSection from "./clients/AlphabetSection";
import ClientDetailDrawer from "./clients/ClientDetailDrawer";
import ClientEmptyState from "./clients/ClientEmptyState";
import ClientSearch from "./clients/ClientSearch";
import "./clients/clients-directory.css";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

export default function ClientsApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });
  const sectionEls = useRef<Record<string, HTMLElement | null>>({});
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      setTick((v) => v + 1);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => setTick((v) => v + 1), []);

  const clients = useMemo(() => {
    void tick;
    return listClients();
  }, [tick]);

  const filtered = useMemo(
    () => clients.filter((c) => matchesClientQuery(c, query)),
    [clients, query],
  );

  const sections = useMemo(
    () => groupClientsAlphabetically(filtered),
    [filtered],
  );

  const presentLetters = useMemo(
    () => new Set(sections.map((s) => s.letter)),
    [sections],
  );

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  const openClient = useCallback((client: WorkClient) => {
    setSelectedId(client.id);
  }, []);

  const closeDrawer = useCallback(() => {
    setSelectedId(null);
  }, []);

  const jumpToLetter = (letter: string) => {
    const el = sectionEls.current[letter];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const row = createClient(form);
    upsertClient(row);
    setShowNew(false);
    setForm({ name: "", phone: "", email: "", address: "", notes: "" });
    refresh();
    setSelectedId(row.id);
  };

  const onTogglePause = (client: WorkClient) => {
    upsertClient(advanceClientStatus(client));
    refresh();
  };

  const onSaveClient = (client: WorkClient) => {
    upsertClient(client);
    refresh();
  };

  const onArchive = (client: WorkClient) => {
    // Soft archive — pause the client. Related jobs/invoices stay intact.
    if (client.status === "active") {
      upsertClient(advanceClientStatus(client));
    }
    setSelectedId(null);
    refresh();
  };

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading clients…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className={`clients-page${selected ? " has-drawer" : ""}`}>
        <header className="clients-page-header">
          <div>
            <p className="hq-eyebrow">Work · Clients</p>
            <h1 className="clients-page-title">Clients</h1>
            <p className="clients-page-lede">
              People and properties you work for
            </p>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => setShowNew(true)}
          >
            Add client
          </button>
        </header>

        <ClientSearch value={query} onChange={setQuery} />

        <div className="clients-directory-layout">
          <div className="clients-directory" ref={listRef}>
            {!filtered.length ? (
              <ClientEmptyState
                searching={Boolean(query.trim())}
                onAdd={() => setShowNew(true)}
              />
            ) : (
              sections.map((section) => (
                <AlphabetSection
                  key={section.letter}
                  letter={section.letter}
                  clients={section.clients}
                  selectedId={selectedId}
                  onOpen={openClient}
                  sectionRef={(el) => {
                    sectionEls.current[section.letter] = el;
                  }}
                />
              ))
            )}
          </div>

          {filtered.length ? (
            <nav className="clients-alpha-index" aria-label="Jump to letter">
              {ALPHA.filter((letter) => presentLetters.has(letter)).map(
                (letter) => (
                  <button
                    key={letter}
                    type="button"
                    className="clients-alpha-jump"
                    onClick={() => jumpToLetter(letter)}
                  >
                    {letter}
                  </button>
                ),
              )}
            </nav>
          ) : null}
        </div>
      </div>

      {selected ? (
        <ClientDetailDrawer
          client={selected}
          requests={listRequests()}
          quotes={listQuotes()}
          jobs={listJobs()}
          invoices={listInvoices()}
          tasks={listTasks()}
          onClose={closeDrawer}
          onSave={onSaveClient}
          onTogglePause={onTogglePause}
          onArchive={onArchive}
        />
      ) : null}

      {showNew ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowNew(false)}
        >
          <div
            className="modal-card create-record-modal"
            role="dialog"
            aria-label="Add client"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="hq-eyebrow">Clients</p>
                <h2 className="panel-title">Add client</h2>
              </div>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setShowNew(false)}
              >
                Close
              </button>
            </div>
            <form className="jobs-form" onSubmit={onAdd}>
              <label>
                Name
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Hal Fisher"
                  autoFocus
                />
              </label>
              <label>
                Phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </label>
              <label>
                Address
                <input
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </label>
              <div className="row-actions">
                <button type="submit" className="btn primary">
                  Save client
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
