"use client";

import { formatDisplayDate } from "@/lib/dates";
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
  daySummary,
  hoursLabel,
  moneyLabel,
  statusVisual,
} from "@/lib/jobs/statusStyles";
import type { Job } from "@/lib/jobs/types";
import { jobStatusLabel } from "@/lib/jobs/types";
import { overdueJobs, unscheduledJobs } from "@/lib/jobs/calendar";
import { jobsOnDate } from "@/lib/jobs/model";

type Props = {
  dateKey: string;
  jobs: Job[];
  onOpenJob: (job: Job) => void;
  onEditJob: (job: Job) => void;
  onPatchJob: (job: Job, patch: Partial<Job>) => void;
  onReschedule: (job: Job) => void;
};

export default function DayView({
  dateKey,
  jobs,
  onOpenJob,
  onEditJob,
  onPatchJob,
  onReschedule,
}: Props) {
  const dayJobs = jobsOnDate(jobs, dateKey);
  const summary = daySummary(dayJobs);
  const attention = [
    ...overdueJobs(jobs).filter((j) => j.scheduledDate === dateKey),
    ...unscheduledJobs(jobs),
  ];

  const runAction = (job: Job, action: JobActionId) => {
    if (action === "open") {
      onOpenJob(job);
      return;
    }
    if (action === "edit") {
      onEditJob(job);
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
      const phone = job.phone.replace(/[^\d+]/g, "");
      window.location.href = `sms:${phone}?&body=${body}`;
      return;
    }
    const patch = statusPatch(action);
    if (patch) onPatchJob(job, patch);
  };

  return (
    <div className="jobs-day">
      <header className="jobs-day-summary">
        <div>
          <h3>{formatDisplayDate(dateKey)}</h3>
          <p>
            {summary.count} job{summary.count === 1 ? "" : "s"} ·{" "}
            {moneyLabel(summary.revenue)} scheduled · {summary.hours}h estimated
          </p>
        </div>
        {attention.length ? (
          <div className="jobs-day-attn">
            <strong>{attention.length} need attention</strong>
            <span>Unscheduled or overdue items in the pipeline</span>
          </div>
        ) : (
          <div className="jobs-day-attn is-clear">
            <strong>Clear</strong>
            <span>No unscheduled or overdue flags for this day</span>
          </div>
        )}
      </header>

      {!dayJobs.length ? (
        <p className="jobs-empty">No jobs scheduled for this day.</p>
      ) : (
        <div className="jobs-day-list">
          {dayJobs.map((job) => {
            const visual = statusVisual(job.status);
            const actions = actionsForJob(job);
            return (
              <article
                key={job.id}
                className={`jobs-day-card ${visual.className}`}
              >
                <div className="jobs-day-card-top">
                  <div>
                    <p className="jobs-day-time">
                      {formatTimeLabel(job.startTime)} –{" "}
                      {formatTimeLabel(job.endTime)}
                    </p>
                    <h4>{job.customerName}</h4>
                    {job.companyName ? (
                      <p className="jobs-day-company">{job.companyName}</p>
                    ) : null}
                  </div>
                  <span className={`jobs-status-pill ${visual.className}`}>
                    {visual.label}
                  </span>
                </div>

                <dl className="jobs-day-meta">
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
                  <dt>Services</dt>
                  <dd>{job.title || job.service}</dd>
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
                  <dt>Invoice</dt>
                  <dd>{job.invoiceStatus}</dd>
                  <dt>Payment</dt>
                  <dd>{job.paymentStatus}</dd>
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
                </dl>

                <div className="jobs-day-actions">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className={`btn small ${
                        action.tone === "primary"
                          ? "primary"
                          : action.tone === "success"
                            ? "success"
                            : action.tone === "danger"
                              ? "ghost"
                              : "ghost"
                      }`}
                      onClick={() => runAction(job, action.id)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {attention.length ? (
        <section className="jobs-day-attention-list">
          <h4>Needs attention</h4>
          <ul>
            {attention.slice(0, 8).map((job) => (
              <li key={`attn-${job.id}`}>
                <button type="button" onClick={() => onOpenJob(job)}>
                  {job.customerName} · {jobStatusLabel(job.status)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
