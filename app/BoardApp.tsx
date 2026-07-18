"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import { WORK_DESKS } from "@/lib/work/catalog";
import {
  buildPipelineCounts,
  buildPipelineNextActions,
} from "@/lib/work/pipeline";
import {
  hydrateStoreFromCloud,
  loadStore,
} from "@/lib/storage";
import AppShell from "./AppShell";

function urgencyChipClass(urgency: string) {
  if (urgency === "overdue") return "status-chip overdue";
  if (urgency === "today") return "status-chip due-today";
  if (urgency === "money") return "status-chip warning";
  return "status-chip neutral";
}

function urgencyChipLabel(urgency: string) {
  if (urgency === "overdue") return "Overdue";
  if (urgency === "today") return "Due today";
  if (urgency === "money") return "Money";
  return "Soon";
}

export default function BoardApp() {
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const date = todayKey();

  useEffect(() => {
    let cancelled = false;
    void hydrateStoreFromCloud().then(() => {
      if (cancelled) return;
      setTick((value) => value + 1);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot = useMemo(() => {
    const store = loadStore();
    const counts = buildPipelineCounts(store);
    const actions = buildPipelineNextActions(store);
    return {
      counts,
      top: actions[0] ?? null,
      actions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, tick]);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  if (!ready) {
    return (
      <AppShell>
        <p className="brand-sub">Loading work…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="page-intro">
        <div>
          <p className="hq-eyebrow">Work</p>
          <h2>{formatDisplayDate(date)}</h2>
          <p>
            Steady pipeline — tap a desk, do the next move, come back.
          </p>
        </div>
        <button type="button" className="btn secondary" onClick={refresh}>
          Refresh
        </button>
      </div>

      <section className="pipeline-strip" aria-label="Work pipeline">
        {snapshot.counts.map((item) => (
          <Link key={item.id} href={item.href} className="pipeline-chip">
            <span className="pipeline-chip-label">{item.label}</span>
            <strong>{item.count}</strong>
            {item.attention > 0 ? (
              <span className="pipeline-chip-attn">{item.attention} need you</span>
            ) : (
              <span className="pipeline-chip-attn muted">Clear</span>
            )}
          </Link>
        ))}
      </section>

      {snapshot.top ? (
        <section className="panel focus-panel jobs-focus" aria-label="Do this next">
          <div className="panel-head">
            <h2 className="panel-title">Do this next</h2>
            <span className={urgencyChipClass(snapshot.top.urgency)}>
              {urgencyChipLabel(snapshot.top.urgency)}
            </span>
          </div>
          <div className="jobs-focus-body">
            <strong>{snapshot.top.title}</strong>
            <p>{snapshot.top.reason}</p>
          </div>
          <div className="row-actions">
            <Link className="btn primary" href={snapshot.top.href}>
              Open {WORK_DESKS.find((d) => d.id === snapshot.top?.deskId)?.name ?? "desk"} →
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel">
          <p className="empty-state">
            Pipeline is quiet. Open a desk below and add a request, client, quote,
            or job.
          </p>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Work desks</h2>
          <span className="panel-meta">Each one is a real place to work</span>
        </div>
        <div className="os-grid">
          <a className="os-card os-sales" href="/work/sales/">
            <div className="os-card-top">
              <h3>Sales OS</h3>
              <span className="os-pill live">Live</span>
            </div>
            <p>Commercial pipeline & outreach</p>
            <span className="os-card-cta">Enter →</span>
          </a>
          <Link className="os-card os-import" href="/work/import">
            <div className="os-card-top">
              <h3>Import</h3>
              <span className="os-pill live">Live</span>
            </div>
            <p>Bring Jobber CSV clients &amp; jobs into HES</p>
            <span className="os-card-cta">Enter →</span>
          </Link>
          {WORK_DESKS.map((desk) => (
            <Link key={desk.id} className={`os-card os-${desk.id}`} href={desk.href}>
              <div className="os-card-top">
                <h3>{desk.name}</h3>
                <span className="os-pill live">Live</span>
              </div>
              <p>{desk.purpose}</p>
              <span className="os-card-metric">
                {snapshot.counts.find((c) => c.id === desk.id)?.attention ?? 0} need
                attention
              </span>
              <span className="os-card-cta">Enter →</span>
            </Link>
          ))}
        </div>
        <p className="hunt-why" style={{ marginTop: "1rem" }}>
          Public website (no login):{" "}
          <Link href="/site">/site</Link>
        </p>
      </section>
    </AppShell>
  );
}
