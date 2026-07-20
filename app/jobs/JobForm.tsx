"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { addMinutesToTime } from "@/lib/jobs/model";
import type { Job, JobInput, JobPriority, JobStatus } from "@/lib/jobs/types";
import { JOB_STATUSES } from "@/lib/jobs/types";
import { OFFERED_SERVICE_LABELS } from "@/lib/hesServices";
import type { WorkClient } from "@/lib/work/types";

type Props = {
  open: boolean;
  initial?: Partial<Job> | null;
  clients: WorkClient[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (input: JobInput & { id?: string }) => void;
};

const SERVICES = OFFERED_SERVICE_LABELS;

export default function JobForm({
  open,
  initial,
  clients,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    initial?.customerId ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState(initial?.customerId || "");
  const [customerName, setCustomerName] = useState(initial?.customerName || "");
  const [companyName, setCompanyName] = useState(initial?.companyName || "");
  const [contactName, setContactName] = useState(initial?.contactName || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [service, setService] = useState(initial?.service || SERVICES[0]);
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [scheduledDate, setScheduledDate] = useState(
    initial?.scheduledDate || "",
  );
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [duration, setDuration] = useState(
    initial?.estimatedDurationMinutes || 120,
  );
  const [amount, setAmount] = useState(
    initial?.amount != null ? String(initial.amount) : "",
  );
  const [assignedTo, setAssignedTo] = useState(initial?.assignedTo || "");
  const [status, setStatus] = useState<JobStatus>(
    initial?.status || (initial?.scheduledDate ? "scheduled" : "unscheduled"),
  );
  const [priority, setPriority] = useState<JobPriority>(
    initial?.priority || "normal",
  );
  const [notes, setNotes] = useState(initial?.notes || "");
  const [customerNotes, setCustomerNotes] = useState(
    initial?.customerNotes || "",
  );
  const [equipmentNeeded, setEquipmentNeeded] = useState(
    initial?.equipmentNeeded || "",
  );
  const [recurringRule, setRecurringRule] = useState(
    initial?.recurringRule || "",
  );

  useEffect(() => {
    if (!open) return;
    setCustomerMode(initial?.customerId ? "existing" : "new");
    setCustomerId(initial?.customerId || "");
    setCustomerName(initial?.customerName || "");
    setCompanyName(initial?.companyName || "");
    setContactName(initial?.contactName || "");
    setPhone(initial?.phone || "");
    setEmail(initial?.email || "");
    setAddress(initial?.address || "");
    setService(initial?.service || SERVICES[0]);
    setTitle(initial?.title || "");
    setDescription(initial?.description || "");
    setScheduledDate(initial?.scheduledDate || "");
    setStartTime(initial?.startTime || "09:00");
    setDuration(initial?.estimatedDurationMinutes || 120);
    setAmount(initial?.amount != null ? String(initial.amount) : "");
    setAssignedTo(initial?.assignedTo || "");
    setStatus(
      initial?.status ||
        (initial?.scheduledDate ? "scheduled" : "unscheduled"),
    );
    setPriority(initial?.priority || "normal");
    setNotes(initial?.notes || "");
    setCustomerNotes(initial?.customerNotes || "");
    setEquipmentNeeded(initial?.equipmentNeeded || "");
    setRecurringRule(initial?.recurringRule || "");
  }, [open, initial]);

  const endTime = useMemo(
    () => addMinutesToTime(startTime || "09:00", Number(duration) || 120),
    [startTime, duration],
  );

  if (!open) return null;

  const applyClient = (id: string) => {
    setCustomerId(id);
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    setCustomerName(client.name);
    setCompanyName("");
    setPhone(client.phone || "");
    setEmail(client.email || "");
    setAddress(client.address || "");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const name = customerName.trim();
    if (!name) return;
    onSubmit({
      id: initial?.id,
      customerId: customerMode === "existing" && customerId ? customerId : null,
      // Keep any existing link quietly; UI no longer edits these.
      requestId: initial?.requestId ?? null,
      prospectId: initial?.prospectId ?? null,
      customerName: name,
      companyName,
      contactName,
      phone,
      email,
      address,
      service,
      title: title || service,
      description,
      scheduledDate,
      startTime,
      endTime,
      estimatedDurationMinutes: Number(duration) || 120,
      amount: amount.trim() === "" ? null : Number(amount),
      assignedTo,
      status: scheduledDate ? status : "unscheduled",
      priority,
      notes,
      customerNotes,
      equipmentNeeded,
      recurringRule,
    });
  };

  return (
    <div className="jobs-modal" role="dialog" aria-modal="true" aria-label="Job form">
      <form className="jobs-modal-panel jobs-form-panel" onSubmit={handleSubmit}>
        <header className="jobs-modal-head">
          <h3>{initial?.id ? "Edit job" : "Create job"}</h3>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="jobs-form-grid">
          <fieldset className="jobs-fieldset">
            <legend>Customer</legend>
            <div className="jobs-segment">
              <button
                type="button"
                className={customerMode === "existing" ? "is-active" : ""}
                onClick={() => setCustomerMode("existing")}
              >
                Existing
              </button>
              <button
                type="button"
                className={customerMode === "new" ? "is-active" : ""}
                onClick={() => setCustomerMode("new")}
              >
                New
              </button>
            </div>
            {customerMode === "existing" ? (
              <label className="jobs-field">
                <span>Select customer</span>
                <select
                  value={customerId}
                  onChange={(e) => applyClient(e.target.value)}
                >
                  <option value="">Choose…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="jobs-field">
              <span>Customer / company name *</span>
              <input
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="jobs-field">
              <span>Company</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </label>
            <label className="jobs-field">
              <span>Contact name</span>
              <input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </label>
            <div className="jobs-form-row">
              <label className="jobs-field">
                <span>Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="jobs-field">
                <span>Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>
            <label className="jobs-field">
              <span>Service address</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
          </fieldset>

          <fieldset className="jobs-fieldset">
            <legend>Job</legend>
            <label className="jobs-field">
              <span>Service type</span>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
              >
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="jobs-field">
              <span>Job title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="jobs-field">
              <span>Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="jobs-form-row">
              <label className="jobs-field">
                <span>Date</span>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                />
              </label>
              <label className="jobs-field">
                <span>Start</span>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
            </div>
            <div className="jobs-form-row">
              <label className="jobs-field">
                <span>Duration (min)</span>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </label>
              <label className="jobs-field">
                <span>End (auto)</span>
                <input type="time" value={endTime} readOnly />
              </label>
            </div>
            <div className="jobs-form-row">
              <label className="jobs-field">
                <span>Price / revenue</span>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="jobs-field">
                <span>Assigned crew</span>
                <input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                />
              </label>
            </div>
            <div className="jobs-form-row">
              <label className="jobs-field">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                >
                  {JOB_STATUSES.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="jobs-field">
                <span>Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as JobPriority)}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <label className="jobs-field">
              <span>Internal notes</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
            <label className="jobs-field">
              <span>Customer-facing notes</span>
              <textarea
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </label>
            <label className="jobs-field">
              <span>Equipment / prep</span>
              <input
                value={equipmentNeeded}
                onChange={(e) => setEquipmentNeeded(e.target.value)}
              />
            </label>
            <label className="jobs-field">
              <span>Recurring</span>
              <select
                value={recurringRule}
                onChange={(e) => setRecurringRule(e.target.value)}
              >
                <option value="">One-time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every 2 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>
          </fieldset>
        </div>

        {error ? <p className="jobs-form-error">{error}</p> : null}

        <footer className="jobs-modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : initial?.id ? "Save changes" : "Create job"}
          </button>
        </footer>
      </form>
    </div>
  );
}
