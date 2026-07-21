"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  groupClientsAlphabetically,
  matchesClientQuery,
} from "@/lib/clients/display";
import {
  buildClientRowSignals,
  gatherClientRelated,
} from "@/lib/clients/related";
import { pushRecentClientId, readRecentClientIds } from "@/lib/clients/recent";
import { createJobRemote } from "@/lib/jobs/api";
import type { Job, JobInput } from "@/lib/jobs/types";
import { advanceClientStatus, findOrCreateClient } from "@/lib/work/model";
import type { ClientType, WorkClient } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  listClients,
  listInvoices,
  listJobs,
  listQuotes,
  listRequests,
  listTasks,
  upsertClient,
  upsertJob,
} from "@/lib/storage";
import AppShell from "./AppShell";
import AddClientModal, {
  type AddClientFormState,
} from "./clients/AddClientModal";
import AlphabetSection from "./clients/AlphabetSection";
import ClientDetailDrawer from "./clients/ClientDetailDrawer";
import ClientEmptyState from "./clients/ClientEmptyState";
import ClientListRow from "./clients/ClientListRow";
import ClientSearch from "./clients/ClientSearch";
import JobForm from "./jobs/JobForm";
import "./clients/clients-directory.css";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

type StatusFilter = "all" | "active" | "paused" | "favorites";
type TypeFilter = "all" | ClientType;

const EMPTY_FORM: AddClientFormState = {
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  clientType: "residential",
  notes: "",
};

export default function ClientsApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientSaving, setClientSaving] = useState(false);
  const [form, setForm] = useState<AddClientFormState>(EMPTY_FORM);
  const sectionEls = useRef<Record<string, HTMLElement | null>>({});
  const addLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      setRecentIds(readRecentClientIds());
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

  const requests = useMemo(() => {
    void tick;
    return listRequests();
  }, [tick]);
  const quotes = useMemo(() => {
    void tick;
    return listQuotes();
  }, [tick]);
  const jobs = useMemo(() => {
    void tick;
    return listJobs();
  }, [tick]);
  const invoices = useMemo(() => {
    void tick;
    return listInvoices();
  }, [tick]);
  const tasks = useMemo(() => {
    void tick;
    return listTasks();
  }, [tick]);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (!matchesClientQuery(c, query)) return false;
      if (statusFilter === "active" && c.status !== "active") return false;
      if (statusFilter === "paused" && c.status !== "paused") return false;
      if (statusFilter === "favorites" && !c.favorite) return false;
      if (typeFilter !== "all" && c.clientType !== typeFilter) return false;
      return true;
    });
  }, [clients, query, statusFilter, typeFilter]);

  const sections = useMemo(
    () => groupClientsAlphabetically(filtered),
    [filtered],
  );

  const presentLetters = useMemo(
    () => new Set(sections.map((s) => s.letter)),
    [sections],
  );

  const favorites = useMemo(
    () => filtered.filter((c) => c.favorite),
    [filtered],
  );

  const recent = useMemo(() => {
    return recentIds
      .map((id) => filtered.find((c) => c.id === id))
      .filter((c): c is WorkClient => Boolean(c));
  }, [recentIds, filtered]);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  const signalMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof buildClientRowSignals>> = {};
    for (const c of filtered) {
      map[c.id] = buildClientRowSignals(
        gatherClientRelated(c, { requests, quotes, jobs, invoices, tasks }),
      );
    }
    return map;
  }, [filtered, requests, quotes, jobs, invoices, tasks]);

  const openClient = useCallback((client: WorkClient) => {
    setSelectedId(client.id);
    setRecentIds(pushRecentClientId(client.id));
  }, []);

  const closeDrawer = useCallback(() => setSelectedId(null), []);

  const jumpToLetter = (letter: string) => {
    sectionEls.current[letter]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || clientSaving || addLock.current) return;
    addLock.current = true;
    setClientSaving(true);
    try {
      const { client: row } = findOrCreateClient(
        listClients(),
        form,
        "clients_os_new_form",
      );
      upsertClient(row);
      setShowNew(false);
      setForm(EMPTY_FORM);
      refresh();
      openClient(row);
    } finally {
      addLock.current = false;
      setClientSaving(false);
    }
  };

  const onSaveClient = (client: WorkClient) => {
    upsertClient(client);
    refresh();
  };

  const onTogglePause = (client: WorkClient) => {
    upsertClient(advanceClientStatus(client));
    refresh();
  };

  const onArchive = (client: WorkClient) => {
    if (client.status === "active") {
      upsertClient(advanceClientStatus(client));
    }
    setSelectedId(null);
    refresh();
  };

  const handleJobSubmit = async (input: JobInput & { id?: string }) => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = await createJobRemote(
        input.id ? { ...input, id: input.id } : input,
      );
      upsertJob(saved);
      setFormOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
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
        <div className="clients-main">
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
              className="btn primary clients-add-btn"
              onClick={() => setShowNew(true)}
            >
              Add client
            </button>
          </header>

          <ClientSearch value={query} onChange={setQuery} />

          <div className="clients-filters" role="toolbar" aria-label="Client filters">
            {(
              [
                ["all", "All"],
                ["favorites", "Favorites"],
                ["active", "Active"],
                ["paused", "Paused"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={statusFilter === id ? "is-active" : ""}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
            <span className="clients-filter-sep" aria-hidden />
            {(
              [
                ["all", "Any type"],
                ["residential", "Residential"],
                ["commercial", "Commercial"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={typeFilter === id ? "is-active" : ""}
                onClick={() => setTypeFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="clients-directory-layout">
            <div className="clients-directory">
              {!filtered.length ? (
                <ClientEmptyState
                  searching={Boolean(query.trim())}
                  onAdd={() => setShowNew(true)}
                />
              ) : (
                <>
                  {recent.length && !query.trim() && statusFilter === "all" ? (
                    <section className="client-alpha-section">
                      <h3 className="client-alpha-sticky">Recent</h3>
                      <ul className="client-row-list">
                        {recent.map((client) => (
                          <li key={`recent-${client.id}`}>
                            <ClientListRow
                              client={client}
                              selected={selectedId === client.id}
                              signals={signalMap[client.id]}
                              onOpen={openClient}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {favorites.length &&
                  !query.trim() &&
                  statusFilter !== "favorites" ? (
                    <section className="client-alpha-section">
                      <h3 className="client-alpha-sticky">Favorites</h3>
                      <ul className="client-row-list">
                        {favorites.map((client) => (
                          <li key={`fav-${client.id}`}>
                            <ClientListRow
                              client={client}
                              selected={selectedId === client.id}
                              signals={signalMap[client.id]}
                              onOpen={openClient}
                            />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {sections.map((section) => (
                    <AlphabetSection
                      key={section.letter}
                      letter={section.letter}
                      clients={section.clients}
                      selectedId={selectedId}
                      signals={signalMap}
                      onOpen={openClient}
                      sectionRef={(el) => {
                        sectionEls.current[section.letter] = el;
                      }}
                    />
                  ))}
                </>
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
          <div className="clients-split-profile">
            <ClientDetailDrawer
              client={selected}
              requests={requests}
              quotes={quotes}
              jobs={jobs}
              invoices={invoices}
              tasks={tasks}
              embedded
              onClose={closeDrawer}
              onSave={onSaveClient}
              onTogglePause={onTogglePause}
              onArchive={onArchive}
              onOpenJobForm={(initial) => {
                setFormInitial(initial);
                setFormError(null);
                setFormOpen(true);
              }}
              onQuickCreateJob={async (input) => {
                const saved = await createJobRemote(input);
                upsertJob(saved);
                refresh();
              }}
              onCreated={refresh}
            />
          </div>
        ) : null}
      </div>

      {/* Mobile overlay when narrow — CSS hides split, shows drawer */}
      {selected ? (
        <div className="clients-mobile-drawer">
          <ClientDetailDrawer
            client={selected}
            requests={requests}
            quotes={quotes}
            jobs={jobs}
            invoices={invoices}
            tasks={tasks}
            onClose={closeDrawer}
            onSave={onSaveClient}
            onTogglePause={onTogglePause}
            onArchive={onArchive}
            onOpenJobForm={(initial) => {
              setFormInitial(initial);
              setFormError(null);
              setFormOpen(true);
            }}
            onQuickCreateJob={async (input) => {
              const saved = await createJobRemote(input);
              upsertJob(saved);
              refresh();
            }}
            onCreated={refresh}
          />
        </div>
      ) : null}

      <JobForm
        open={formOpen}
        initial={formInitial}
        clients={clients}
        saving={saving}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleJobSubmit}
      />

      <AddClientModal
        open={showNew}
        form={form}
        saving={clientSaving}
        clients={clients}
        onChange={setForm}
        onClose={() => {
          if (clientSaving) return;
          setShowNew(false);
        }}
        onSubmit={onAdd}
      />
    </AppShell>
  );
}
