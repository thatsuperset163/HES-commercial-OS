"use client";

import {
  actionsForJob,
  etaSmsBody,
  mapsUrl,
  statusPatch,
  telUrl,
  type JobActionId,
} from "@/lib/jobs/actions";
import { formatTimeLabel } from "@/lib/jobs/model";
import {
  hoursLabel,
  moneyLabel,
  statusVisual,
} from "@/lib/jobs/statusStyles";
import type { Job } from "@/lib/jobs/types";
import { jobStatusLabel } from "@/lib/jobs/types";

type Props = {
  job: Job | null;
  onClose: () => void;
  onEdit: (job: Job) => void;
  onPatch: (job: Job, patch: Partial<Job>) => void;
  onReschedule: (job: Job) => void;
};

export default function JobDetailsPanel({
  job,
  onClose,
  onEdit,
  onPatch,
  onReschedule,
}: Props) {
  if (!job) return null;
  const visual = statusVisual(job.status);

  const run = (action: JobActionId) => {
    if (action === "edit" || action === "open") {
      onEdit(job);
      return;
    }
    if (action === "reschedule") {
      onReschedule(job);
      return;
    }
    if (action === "call" && job.phone) {
      window.location.href = telUrl(job.phone);
      return;
    }
    if (action === "navigate" && job.address) {
      window.open(mapsUrl(job.address), "_blank", "noopener,noreferrer");
      return;
    }
    if (action === "send_eta" && job.phone) {
      const body = encodeURIComponent(etaSmsBody(job));
      window.location.href = `sms:${job.phone.replace(/[^\d+]/g, "")}?&body=${body}`;
      return;
    }
    const patch = statusPatch(action);
    if (patch) onPatch(job, patch);
  };

  return (
    <aside className="jobs-details" aria-label="Job details">
      <header className="jobs-details-head">
        <div>
          <p className="hq-eyebrow">Job</p>
          <h3>{job.title || job.service}</h3>
          <p>{job.customerName}</p>
        </div>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </header>

      <span className={`jobs-status-pill ${visual.className}`}>
        {jobStatusLabel(job.status)}
      </span>

      <dl className="jobs-day-meta">
        <dt>When</dt>
        <dd>
          {job.scheduledDate || "Unscheduled"}
          {job.startTime
            ? ` · ${formatTimeLabel(job.startTime)}–${formatTimeLabel(job.endTime)}`
            : ""}
        </dd>
        {job.companyName ? (
          <>
            <dt>Company</dt>
            <dd>{job.companyName}</dd>
          </>
        ) : null}
        {job.address ? (
          <>
            <dt>Address</dt>
            <dd>{job.address}</dd>
          </>
        ) : null}
        {job.phone ? (
          <>
            <dt>Phone</dt>
            <dd>{job.phone}</dd>
          </>
        ) : null}
        <dt>Revenue</dt>
        <dd>{moneyLabel(job.amount)}</dd>
        <dt>Duration</dt>
        <dd>{hoursLabel(job.estimatedDurationMinutes)}</dd>
        {job.assignedTo ? (
          <>
            <dt>Crew</dt>
            <dd>{job.assignedTo}</dd>
          </>
        ) : null}
        {job.notes ? (
          <>
            <dt>Notes</dt>
            <dd>{job.notes}</dd>
          </>
        ) : null}
        {job.equipmentNeeded ? (
          <>
            <dt>Equipment</dt>
            <dd>{job.equipmentNeeded}</dd>
          </>
        ) : null}
        <dt>Invoice</dt>
        <dd>{job.invoiceStatus}</dd>
        <dt>Payment</dt>
        <dd>{job.paymentStatus}</dd>
      </dl>

      <div className="jobs-day-actions">
        {actionsForJob(job).map((action) => (
          <button
            key={action.id}
            type="button"
            className={`btn small ${action.tone === "primary" ? "primary" : action.tone === "success" ? "success" : "ghost"}`}
            onClick={() => run(action.id)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
