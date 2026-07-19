"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, formatDisplayDate, getWeekKeys, todayKey } from "@/lib/dates";
import {
  createJobRemote,
  fetchJobs,
  updateJobRemote,
} from "@/lib/jobs/api";
import {
  DEFAULT_FILTERS,
  filterJobs,
  monthLabel,
  shiftMonth,
  shiftWeek,
  weekRangeLabel,
  type ScheduleFilterState,
} from "@/lib/jobs/calendar";
import { addMinutesToTime, createJob, patchJob } from "@/lib/jobs/model";
import type { CalendarView, Job, JobInput } from "@/lib/jobs/types";
import {
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  listRequests,
  upsertJob,
} from "@/lib/storage";
import AppShell from "./AppShell";
import DayView from "./jobs/DayView";
import JobDetailsPanel from "./jobs/JobDetailsPanel";
import JobForm from "./jobs/JobForm";
import JobsCalendar from "./jobs/JobsCalendar";
import ScheduleFilters from "./jobs/ScheduleFilters";
import "./jobs-os.css";

type UndoState = {
  job: Job;
  previous: { scheduledDate: string; startTime: string; endTime: string; status: Job["status"] };
} | null;

export default function JobsApp() {
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [anchorKey, setAnchorKey] = useState(todayKey());
  const [filters, setFilters] = useState<ScheduleFilterState>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formInitial, setFormInitial] = useState<Partial<Job> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState>(null);
  const [clients, setClients] = useState(listClients());
  const [requestOptions, setRequestOptions] = useState<
    { id: string; label: string }[]
  >([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refreshLocalMeta = useCallback(() => {
    setClients(listClients());
    setRequestOptions(
      listRequests().map((r) => ({
        id: r.id,
        label: `${r.clientName} · ${r.summary || "Request"}`,
      })),
    );
  }, []);

  const loadJobs = useCallback(async () => {
    setError(null);
    try {
      const remote = await fetchJobs();
      setJobs(remote);
      setCloud(true);
      // Mirror into blackboard so pipeline desks stay aligned.
      for (const job of remote) upsertJob(job);
      return remote;
    } catch (err) {
      const local = listJobs();
      setJobs(local);
      setCloud(false);
      setError(
        err instanceof Error
          ? `${err.message} — showing local blackboard jobs.`
          : "Cloud unavailable — showing local jobs.",
      );
      return local;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateStoreFromCloud();
      if (cancelled) return;
      refreshLocalMeta();
      // Seed cloud from blackboard once if cloud is empty.
      try {
        const remote = await fetchJobs();
        if (!remote.length) {
          const local = listJobs();
          for (const job of local) {
            await createJobRemote({ ...job, id: job.id });
          }
        }
      } catch {
        // Fall through to loadJobs fallback.
      }
      if (cancelled) return;
      await loadJobs();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadJobs, refreshLocalMeta]);

  const filtered = useMemo(
    () => filterJobs(jobs, filters),
    [jobs, filters],
  );

  const periodLabel = useMemo(() => {
    if (view === "month") return monthLabel(anchorKey);
    if (view === "week") return weekRangeLabel(getWeekKeys(anchorKey));
    return formatDisplayDate(anchorKey);
  }, [view, anchorKey]);

  const goPrev = () => {
    if (view === "month") setAnchorKey((k) => shiftMonth(k, -1));
    else if (view === "week") setAnchorKey((k) => shiftWeek(k, -1));
    else setAnchorKey((k) => addDays(k, -1));
  };

  const goNext = () => {
    if (view === "month") setAnchorKey((k) => shiftMonth(k, 1));
    else if (view === "week") setAnchorKey((k) => shiftWeek(k, 1));
    else setAnchorKey((k) => addDays(k, 1));
  };

  const persistRemote = async (job: Job) => {
    setSaving(true);
    setError(null);
    try {
      let saved: Job;
      if (jobs.some((j) => j.id === job.id)) {
        saved = await updateJobRemote(job.id, job);
      } else {
        saved = await createJobRemote(job);
      }
      upsertJob(saved);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const next = [...prev];
        next[idx] = saved;
        return next;
      });
      setSelected((cur) => (cur?.id === saved.id ? saved : cur));
      showToast("Saved to cloud");
      return saved;
    } catch (err) {
      // Local fallback only when cloud is down — still surface the error.
      upsertJob(job);
      setJobs((prev) => {
        const idx = prev.findIndex((j) => j.id === job.id);
        if (idx === -1) return [...prev, job];
        const next = [...prev];
        next[idx] = job;
        return next;
      });
      const message =
        err instanceof Error ? err.message : "Could not save job to Supabase";
      setError(message);
      showToast("Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const openCreate = (dateKey?: string, startTime?: string) => {
    setFormInitial({
      scheduledDate: dateKey || "",
      startTime: startTime || "09:00",
      status: dateKey ? "scheduled" : "unscheduled",
    });
    setFormOpen(true);
  };

  const openEdit = (job: Job) => {
    setFormInitial(job);
    setFormOpen(true);
  };

  const handleSubmit = async (input: JobInput & { id?: string }) => {
    setSaving(true);
    setError(null);
    try {
      let saved: Job;
      if (input.id) {
        const current = jobs.find((j) => j.id === input.id);
        const next = patchJob(current || createJob(input), {
          ...input,
          id: input.id,
        } as Partial<Job>);
        saved = await updateJobRemote(input.id, next);
      } else {
        saved = await createJobRemote(input);
      }
      upsertJob(saved);
      await loadJobs();
      setFormOpen(false);
      setSelected(saved);
      showToast(input.id ? "Job updated" : "Job created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePatch = async (job: Job, patch: Partial<Job>) => {
    const next = patchJob(job, patch);
    try {
      await persistRemote(next);
    } catch {
      // error already set
    }
  };

  const handleDragReschedule = async (
    job: Job,
    scheduledDate: string,
    startTime: string,
  ) => {
    const previous = {
      scheduledDate: job.scheduledDate,
      startTime: job.startTime,
      endTime: job.endTime,
      status: job.status,
    };
    const endTime = addMinutesToTime(
      startTime,
      job.estimatedDurationMinutes || 120,
    );
    const next = patchJob(job, {
      scheduledDate,
      startTime,
      endTime,
      status: job.status === "unscheduled" ? "scheduled" : job.status,
    });
    try {
      await persistRemote(next);
      setUndo({ job: next, previous });
      showToast("Rescheduled — Undo available");
    } catch {
      // keep prior
    }
  };

  const undoReschedule = async () => {
    if (!undo) return;
    const next = patchJob(undo.job, undo.previous);
    try {
      await persistRemote(next);
      setUndo(null);
      showToast("Reschedule undone");
    } catch {
      // keep banner
    }
  };

  if (!ready) {
    return (
      <AppShell>
        <p className="hq-lede">Loading Jobs OS…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="jobs-os-page">
        <header className="jobs-os-header">
          <div>
            <p className="hq-eyebrow">Work · Jobs OS</p>
            <h2>Schedule</h2>
            <p className="jobs-os-period">{periodLabel}</p>
          </div>
          <div className="jobs-os-controls">
            <div className="jobs-os-nav">
              <button type="button" className="btn ghost small" onClick={goPrev}>
                Prev
              </button>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => setAnchorKey(todayKey())}
              >
                Today
              </button>
              <button type="button" className="btn ghost small" onClick={goNext}>
                Next
              </button>
            </div>
            <div className="jobs-view-toggle" role="tablist" aria-label="Calendar view">
              {(["month", "week", "day"] as CalendarView[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  className={view === id ? "is-active" : ""}
                  onClick={() => setView(id)}
                >
                  {id[0].toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters
            </button>
            <button
              type="button"
              className="btn primary small"
              onClick={() => openCreate(view === "day" ? anchorKey : undefined)}
            >
              Create Job
            </button>
          </div>
        </header>

        <div className="jobs-os-statusline">
          <span className={`hq-pill${cloud ? " accent" : ""}`}>
            {cloud ? "Cloud synced" : "Local fallback"}
          </span>
          {error ? <span className="jobs-os-error">{error}</span> : null}
          {undo ? (
            <button type="button" className="btn ghost small" onClick={undoReschedule}>
              Undo reschedule
            </button>
          ) : null}
        </div>

        <ScheduleFilters
          open={filtersOpen}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />

        <div className={`jobs-os-body${selected ? " has-details" : ""}`}>
          <JobsCalendar
            view={view}
            anchorKey={anchorKey}
            jobs={filtered}
            filters={filters}
            onSelectJob={setSelected}
            onOpenDay={(dateKey) => {
              setAnchorKey(dateKey);
              setView("day");
            }}
            onCreateOnDate={(dateKey, startTime) => openCreate(dateKey, startTime)}
            onPatchJob={handlePatch}
            onEditJob={openEdit}
            onRescheduleJob={openEdit}
            onDragReschedule={handleDragReschedule}
          />
          {selected ? (
            <JobDetailsPanel
              job={selected}
              onClose={() => setSelected(null)}
              onEdit={openEdit}
              onPatch={handlePatch}
              onReschedule={openEdit}
            />
          ) : null}
        </div>

        {/* Mobile-friendly agenda when month is cramped */}
        {view === "month" ? (
          <div className="jobs-mobile-agenda">
            <h3>Today</h3>
            <DayView
              dateKey={todayKey()}
              jobs={filtered}
              onOpenJob={setSelected}
              onEditJob={openEdit}
              onPatchJob={handlePatch}
              onReschedule={openEdit}
            />
          </div>
        ) : null}

        <JobForm
          open={formOpen}
          initial={formInitial}
          clients={clients}
          requests={requestOptions}
          prospects={[]}
          saving={saving}
          error={error}
          onClose={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />

        {toast ? <div className="jobs-toast">{toast}</div> : null}
      </div>
    </AppShell>
  );
}
