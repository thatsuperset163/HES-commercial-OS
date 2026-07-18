"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  importClientsFromCsv,
  importJobsFromCsv,
} from "@/lib/jobber/map";
import {
  hydrateStoreFromCloud,
  listClients,
  listJobs,
  upsertClient,
  upsertJob,
} from "@/lib/storage";
import AppShell from "./AppShell";

type Mode = "clients" | "jobs";

export default function ImportApp() {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("clients");
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ label: string; detail: string }[]>(
    [],
  );
  const [counts, setCounts] = useState({ clients: 0, jobs: 0 });

  const refreshCounts = useCallback(() => {
    setCounts({
      clients: listClients().length,
      jobs: listJobs().length,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      refreshCounts();
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCounts]);

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(String(reader.result || ""));
      setMessage(`Loaded ${file.name}`);
      setPreview([]);
    };
    reader.readAsText(file);
  }

  function runPreview() {
    if (!raw.trim()) {
      setMessage("Paste a CSV or choose a file first.");
      return;
    }
    if (mode === "clients") {
      const result = importClientsFromCsv(raw);
      setPreview(result.preview);
      setMessage(
        `Ready: ${result.clients.length} clients` +
          (result.skipped ? ` · ${result.skipped} blank rows skipped` : ""),
      );
      return;
    }
    const result = importJobsFromCsv(raw);
    setPreview(result.preview);
    setMessage(
      `Ready: ${result.jobs.length} jobs (+ ${result.clients.length} clients)` +
        (result.skipped ? ` · ${result.skipped} blank rows skipped` : ""),
    );
  }

  function runImport() {
    if (!raw.trim()) {
      setMessage("Paste a CSV or choose a file first.");
      return;
    }
    if (mode === "clients") {
      const result = importClientsFromCsv(raw);
      for (const client of result.clients) upsertClient(client);
      refreshCounts();
      setPreview(result.preview);
      setMessage(`Imported ${result.clients.length} clients into Clients.`);
      return;
    }
    const result = importJobsFromCsv(raw);
    for (const client of result.clients) upsertClient(client);
    for (const job of result.jobs) upsertJob(job);
    refreshCounts();
    setPreview(result.preview);
    setMessage(
      `Imported ${result.jobs.length} jobs and ${result.clients.length} clients.`,
    );
  }

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading import…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Work · Import</p>
          <h2>{formatDisplayDate(todayKey())}</h2>
          <p>
            Pull Jobber CSV exports into Clients and Jobs so you can leave Jobber
            without losing history.
          </p>
        </div>
        <div className="jobs-intro-actions">
          <Link href="/work" className="btn secondary">
            Work home
          </Link>
          <Link href="/work/clients" className="btn secondary">
            Clients ({counts.clients})
          </Link>
          <Link href="/work/jobs" className="btn secondary">
            Jobs ({counts.jobs})
          </Link>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">1. What are you importing?</h2>
        </div>
        <div className="hunt-actions">
          <button
            type="button"
            className={`btn ${mode === "clients" ? "primary" : "secondary"}`}
            onClick={() => {
              setMode("clients");
              setPreview([]);
              setMessage("");
            }}
          >
            Clients CSV
          </button>
          <button
            type="button"
            className={`btn ${mode === "jobs" ? "primary" : "secondary"}`}
            onClick={() => {
              setMode("jobs");
              setPreview([]);
              setMessage("");
            }}
          >
            Jobs CSV
          </button>
        </div>
        <p className="hunt-why">
          In Jobber: Reports → Clients report or One-off jobs report → Export to
          CSV. Then upload that file here.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">2. Upload or paste CSV</h2>
        </div>
        <label className="field-label" htmlFor="jobber-file">
          CSV file
          <input
            id="jobber-file"
            className="field"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="field-label" htmlFor="jobber-raw">
          Or paste CSV text
          <textarea
            id="jobber-raw"
            className="field textarea journal-field"
            rows={8}
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
            placeholder="Client Name,Email,Main Phone,Street,City..."
          />
        </label>
        <div className="hunt-actions">
          <button type="button" className="btn secondary" onClick={runPreview}>
            Preview
          </button>
          <button type="button" className="btn primary" onClick={runImport}>
            Import into HES
          </button>
        </div>
        {message ? <p className="hunt-mission">{message}</p> : null}
      </section>

      {preview.length ? (
        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">Preview</h2>
            <span className="panel-meta">First rows</span>
          </div>
          <ul className="jobs-list">
            {preview.map((row) => (
              <li key={`${row.label}-${row.detail}`} className="jobs-row">
                <div className="jobs-row-main">
                  <strong>{row.label}</strong>
                  <p>{row.detail || "—"}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppShell>
  );
}
