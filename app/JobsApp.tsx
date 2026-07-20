"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
  listTasks,
  upsertJob,
} from "@/lib/storage";
import type { CreateNewKind } from "@/lib/createNew/catalog";
import {
  intakeEstimatesToOverlays,
  overlayAsDisplayJob,
  tasksToOverlays,
} from "@/lib/createNew/scheduleOverlays";
import type { IntakeRequest } from "@/lib/requestsCenter/types";
import AppShell from "./AppShell";
import CreateNewController, {
  type CreateContext,
} from "./create/CreateNewController";
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

function parseViewParam(value: string | null): CalendarView | null {
  if (value === "month" || value === "week" || value === "day") return value;
  return null;
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export default function JobsApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [view, setView] = useState<CalendarView>(
    () => parseViewParam(searchParams.get("view")) ?? "month",
  );
  const [anchorKey, setAnchorKey] = useState(
    () => parseDateParam(searchParams.get("date")) ?? todayKey(),
  );
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
  const [intakeRows, setIntakeRows] = useState<IntakeRequest[]>([]);
  const [createContext, setCreateContext] = useState<CreateContext | null>(null);

  const syncScheduleUrl = useCallback(
    (nextView: CalendarView, nextDate: string) => {
      const params = new URLSearchParams();
      params.set("view", nextView);
      params.set("date", nextDate);
      router.replace(`/work/jobs?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  const goToView = useCallback(
    (nextView: CalendarView) => {
      setView(nextView);
      syncScheduleUrl(nextView, anchorKey);
    },
    [anchorKey, syncScheduleUrl],
  );

  const goToDate = useCallback(
    (nextDate: string, nextView: CalendarView = view) => {
      setAnchorKey(nextDate);
      setView(nextView);
      syncScheduleUrl(nextView, nextDate);
    },
    [syncScheduleUrl, view],
  );

  // Deep-link from Home "This Week" (and shareable URLs).
  useEffect(() => {
    const nextView = parseViewParam(searchParams.get("view"));
    const nextDate = parseDateParam(searchParams.get("date"));
    if (nextView) setView(nextView);
    if (nextDate) setAnchorKey(nextDate);
  }, [searchParams]);

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

  const loadIntake = useCallback(async () => {
    try {
      const res = await fetch("/api/requests", { credentials: "same-origin" });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { requests: IntakeRequest[] };
      };
      if (res.ok && json.ok && json.data?.requests) {
        setIntakeRows(json.data.requests);
      }
    } catch {
      setIntakeRows([]);
    }
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
      await loadJobs();
      await loadIntake();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadJobs, loadIntake, refreshLocalMeta]);

  const overlayJobs = useMemo(() => {
    const overlays = [
      ...tasksToOverlays(listTasks()),
      ...intakeEstimatesToOverlays(intakeRows),
    ];
    return overlays.map(overlayAsDisplayJob);
  }, [intakeRows, jobs, toast]);

  const filtered = useMemo(
    () => filterJobs([...jobs, ...overlayJobs], filters),
    [jobs, overlayJobs, filters],
  );

  const periodLabel = useMemo(() => {
    if (view === "month") return monthLabel(anchorKey);
    if (view === "week") return weekRangeLabel(getWeekKeys(anchorKey));
    return formatDisplayDate(anchorKey);
  }, [view, anchorKey]);

  const goPrev = () => {
    const next =
      view === "month"
        ? shiftMonth(anchorKey, -1)
        : view === "week"
          ? shiftWeek(anchorKey, -1)
          : addDays(anchorKey, -1);
    goToDate(next, view);
  };

  const goNext = () => {
    const next =
      view === "month"
        ? shiftMonth(anchorKey, 1)
        : view === "week"
          ? shiftWeek(anchorKey, 1)
          : addDays(anchorKey, 1);
    goToDate(next, view);
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
    setCreateContext({
      dateKey: dateKey || todayKey(),
      startTime: startTime || "09:00",
    });
  };

  const openEdit = (job: Job) => {
    if (job.notes.startsWith("overlay:")) {
      const href = job.notes.split(":").slice(2).join(":") || "/work";
      window.location.href = href;
      return;
    }
    setFormInitial(job);
    setFormOpen(true);
  };

  const selectJob = (job: Job) => {
    if (job.notes.startsWith("overlay:")) {
      const href = job.notes.split(":").slice(2).join(":") || "/work";
      window.location.href = href;
      return;
    }
    setSelected(job);
  };

  const quickCreateJob = async (input: JobInput) => {
    const saved = await createJobRemote(input);
    upsertJob(saved);
    await loadJobs();
    showToast("Added to calendar");
  };

  const afterCreate = async (_kind: CreateNewKind) => {
    refreshLocalMeta();
    await loadIntake();
    await loadJobs();
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
    if (job.notes.startsWith("overlay:")) return;
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
    if (job.notes.startsWith("overlay:")) return;
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
                onClick={() => goToDate(todayKey(), view)}
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
                  onClick={() => goToView(id)}
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
            <CreateNewController
              size="small"
              label="Create New"
              context={createContext}
              onContextHandled={() => setCreateContext(null)}
              onOpenJobForm={(initial) => {
                setFormInitial(initial);
                setFormOpen(true);
              }}
              onQuickCreateJob={quickCreateJob}
              onCreated={afterCreate}
            />
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
            onSelectJob={selectJob}
            onOpenDay={(dateKey) => {
              goToDate(dateKey, "day");
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
              onOpenJob={selectJob}
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
