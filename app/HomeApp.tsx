"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  getOrCreateDay,
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  listRequests,
  loadStore,
  upsertDay,
  upsertJob,
} from "@/lib/storage";
import { createJobRemote, fetchJobs } from "@/lib/jobs/api";
import { buildWeekGlance } from "@/lib/jobs/calendar";
import type { Job, JobInput } from "@/lib/jobs/types";
import { buildPipelineNextActions } from "@/lib/work/pipeline";
import {
  HOME_QUICK_LINKS,
  jobsDayHref,
  resolveQuickHref,
} from "@/lib/osNav";
import type { DayEntry } from "@/lib/types";
import AppShell from "./AppShell";
import CreateNewController from "./create/CreateNewController";
import JobForm from "./jobs/JobForm";
import HQWeekAtGlance from "./jobs/HQWeekAtGlance";
import "./jobs-os.css";
import "./home-shell.css";

export default function HomeApp() {
  const [ready, setReady] = useState(false);
  const [day, setDay] = useState<DayEntry | null>(null);
  const [scheduleJobs, setScheduleJobs] = useState<Job[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clients, setClients] = useState(listClients());
  const [requestOptions, setRequestOptions] = useState<
    { id: string; label: string }[]
  >([]);
  const date = todayKey();

  const refreshMeta = useCallback(() => {
    setClients(listClients());
    setRequestOptions(
      listRequests().map((r) => ({
        id: r.id,
        label: `${r.clientName} · ${r.summary || "Request"}`,
      })),
    );
  }, []);

  const refresh = useCallback(() => {
    const store = loadStore();
    const entry = getOrCreateDay(store, date);
    if (!store.days[date]) upsertDay(store, entry);
    setDay(entry);
    setReady(true);
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(async () => {
      if (cancelled) return;
      refresh();
      refreshMeta();
      try {
        const remote = await fetchJobs();
        if (!cancelled) setScheduleJobs(remote);
      } catch {
        if (!cancelled) setScheduleJobs(listJobs());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, refreshMeta]);

  const handleJobSubmit = async (input: JobInput & { id?: string }) => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = input.id
        ? await createJobRemote({ ...input, id: input.id })
        : await createJobRemote(input);
      upsertJob(saved);
      setScheduleJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const snapshot = useMemo(() => {
    if (!day) return null;
    const store = loadStore();
    const workActions = buildPipelineNextActions(store);
    const week = buildWeekGlance(
      scheduleJobs.length ? scheduleJobs : listJobs(),
      date,
    );
    return {
      week,
      workTop: workActions[0] ?? null,
    };
  }, [day, date, scheduleJobs]);

  if (!ready || !day || !snapshot) {
    return (
      <AppShell>
        <p className="hq-lede">Loading…</p>
      </AppShell>
    );
  }

  const quickLinks = HOME_QUICK_LINKS.map((link) => ({
    ...link,
    href: resolveQuickHref(link.href, date),
  }));

  return (
    <AppShell>
      <div className="home-page">
        <header className="home-hero">
          <div>
            <p className="hq-eyebrow">Harris Exterior Solutions</p>
            <h1 className="home-hero-title">{formatDisplayDate(date)}</h1>
            <p className="home-hero-lede">
              Your week, next move, and shortcuts — open any OS from the menu or
              search.
            </p>
          </div>
          <CreateNewController
            size="small"
            label="Create New"
            onOpenJobForm={(initial) => {
              setFormInitial(initial);
              setFormError(null);
              setFormOpen(true);
            }}
            onQuickCreateJob={async (input) => {
              const saved = await createJobRemote(input);
              upsertJob(saved);
              setScheduleJobs((prev) => [...prev, saved]);
            }}
            onCreated={async () => {
              refreshMeta();
              try {
                setScheduleJobs(await fetchJobs());
              } catch {
                setScheduleJobs(listJobs());
              }
            }}
          />
        </header>

        <HQWeekAtGlance days={snapshot.week} />

        {snapshot.workTop ? (
          <section className="home-card home-next">
            <div className="hq-section-head">
              <h2>Do this next</h2>
              <span className="hq-pill">Live</span>
            </div>
            <p className="hq-work-next-title">{snapshot.workTop.title}</p>
            <p>{snapshot.workTop.reason}</p>
            <Link href={snapshot.workTop.href} className="hq-link">
              Open →
            </Link>
          </section>
        ) : null}

        <section className="home-card" aria-label="Quick links">
          <div className="hq-section-head">
            <h2>Quick links</h2>
            <span className="hq-pill">Shortcuts</span>
          </div>
          <div className="home-quick-grid">
            {quickLinks.map((link) => (
              <Link key={link.id} href={link.href} className="home-quick-card">
                <strong>{link.label}</strong>
                <span>{link.description}</span>
              </Link>
            ))}
            <div className="home-quick-card is-placeholder" aria-hidden>
              <strong>More soon</strong>
              <span>Room for the shortcuts you use most</span>
            </div>
          </div>
        </section>

        <section className="home-card home-note-slot" aria-label="Ideas">
          <div className="hq-section-head">
            <h2>Ideas &amp; later</h2>
            <span className="hq-pill">Open</span>
          </div>
          <p>
            Space for widgets you invent as you use the OS — pin a desk, a cash
            pulse, or whatever you open every morning.
          </p>
          <Link href={jobsDayHref(date)} className="hq-link">
            Jump to today&apos;s agenda →
          </Link>
        </section>
      </div>

      <JobForm
        open={formOpen}
        initial={formInitial}
        clients={clients}
        requests={requestOptions}
        prospects={[]}
        saving={saving}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={handleJobSubmit}
      />
    </AppShell>
  );
}
