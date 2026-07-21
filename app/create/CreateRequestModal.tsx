"use client";

import { FormEvent, useEffect, useState } from "react";
import { todayKey } from "@/lib/dates";
import { OFFERED_SERVICE_LABELS } from "@/lib/hesServices";
import {
  INTAKE_PRIORITIES,
  REQUEST_SOURCES,
  type IntakeRequest,
} from "@/lib/requestsCenter/types";
import type { WorkClient } from "@/lib/work/types";
import { listClients } from "@/lib/storage";

type Props = {
  open: boolean;
  defaultDate?: string;
  /** Prefill from an open client profile. */
  defaultClient?: WorkClient | null;
  /** When set, also schedule a quote visit estimate on this date. */
  scheduleEstimate?: boolean;
  onClose: () => void;
  onCreated: (result: {
    request: IntakeRequest;
    href: string;
    openLabel: string;
  }) => void;
};

export default function CreateRequestModal({
  open,
  defaultDate,
  defaultClient = null,
  scheduleEstimate = false,
  onClose,
  onCreated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    defaultClient ? "existing" : "new",
  );
  const clients = open ? listClients() : [];
  const date = defaultDate || todayKey();

  useEffect(() => {
    if (open) {
      setError(null);
      setClientMode(defaultClient ? "existing" : "new");
    }
  }, [open, defaultClient]);

  if (!open) return null;

  const applyClient = (id: string, form: HTMLFormElement) => {
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const name = form.elements.namedItem("customerName") as HTMLInputElement | null;
    const phone = form.elements.namedItem("phone") as HTMLInputElement | null;
    const email = form.elements.namedItem("email") as HTMLInputElement | null;
    const address = form.elements.namedItem("address") as HTMLInputElement | null;
    const linked = form.elements.namedItem("linkedClientId") as HTMLInputElement | null;
    if (name) name.value = client.name;
    if (phone) phone.value = client.phone;
    if (email) email.value = client.email;
    if (address) address.value = client.address;
    if (linked) linked.value = client.id;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const customerName = String(fd.get("customerName") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const email = String(fd.get("email") || "").trim();
    if (!customerName) {
      setError("Customer name is required");
      return;
    }
    if (!phone && !email) {
      setError("Phone or email is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        customerName,
        company: String(fd.get("company") || ""),
        phone,
        email,
        address: String(fd.get("address") || ""),
        serviceRequested: String(fd.get("serviceRequested") || ""),
        requestSource: String(fd.get("requestSource") || "manual"),
        priority: String(fd.get("priority") || "normal"),
        notes: String(fd.get("notes") || ""),
        dateReceived: String(fd.get("dateReceived") || todayKey()),
        status: scheduleEstimate ? "estimate_scheduled" : "new",
        linkedClientId: String(fd.get("linkedClientId") || "") || null,
      };
      if (scheduleEstimate) {
        body.estimateDate = String(fd.get("estimateDate") || date);
        body.estimateTime = String(fd.get("estimateTime") || "10:00");
      }

      const res = await fetch("/api/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { request: IntakeRequest };
        error?: { message: string };
      };
      if (!res.ok || !json.ok || !json.data?.request) {
        throw new Error(json.error?.message || "Could not create request");
      }

      onCreated({
        request: json.data.request,
        href: "/work/requests",
        openLabel: "Go to Requests Center",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card create-record-modal"
        role="dialog"
        aria-label={scheduleEstimate ? "Schedule quote visit" : "New request"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 className="panel-title">
            {scheduleEstimate ? "Quote visit" : "New request"}
          </h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="jobs-form" onSubmit={onSubmit}>
          <div className="jobs-segment" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={clientMode === "existing" ? "is-active" : ""}
              onClick={() => setClientMode("existing")}
            >
              Existing client
            </button>
            <button
              type="button"
              className={clientMode === "new" ? "is-active" : ""}
              onClick={() => setClientMode("new")}
            >
              New contact
            </button>
          </div>
          {clientMode === "existing" ? (
            <label className="field-label">
              Select client
              <select
                className="field"
                defaultValue={defaultClient?.id || ""}
                onChange={(e) =>
                  applyClient(e.target.value, e.currentTarget.form!)
                }
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
          <input
            type="hidden"
            name="linkedClientId"
            defaultValue={defaultClient?.id || ""}
          />
          <div className="jobs-form-row">
            <label className="field-label">
              Customer name *
              <input
                className="field"
                name="customerName"
                required
                autoFocus
                defaultValue={defaultClient?.name || ""}
              />
            </label>
            <label className="field-label">
              Company
              <input
                className="field"
                name="company"
                defaultValue={defaultClient?.companyName || ""}
              />
            </label>
          </div>
          <div className="jobs-form-row">
            <label className="field-label">
              Phone
              <input
                className="field"
                name="phone"
                type="tel"
                defaultValue={defaultClient?.phone || ""}
              />
            </label>
            <label className="field-label">
              Email
              <input
                className="field"
                name="email"
                type="email"
                defaultValue={defaultClient?.email || ""}
              />
            </label>
          </div>
          <label className="field-label">
            Service address
            <input
              className="field"
              name="address"
              defaultValue={defaultClient?.address || ""}
            />
          </label>
          <label className="field-label">
            Service requested
            <select className="field" name="serviceRequested" defaultValue={OFFERED_SERVICE_LABELS[0]}>
              {OFFERED_SERVICE_LABELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="jobs-form-row">
            <label className="field-label">
              Request source
              <select className="field" name="requestSource" defaultValue="manual">
                {REQUEST_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Priority
              <select className="field" name="priority" defaultValue="normal">
                {INTAKE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Date received
              <input
                className="field"
                name="dateReceived"
                type="date"
                defaultValue={todayKey()}
              />
            </label>
          </div>
          {scheduleEstimate ? (
            <div className="jobs-form-row">
              <label className="field-label">
                Visit date
                <input
                  className="field"
                  name="estimateDate"
                  type="date"
                  defaultValue={date}
                  required
                />
              </label>
              <label className="field-label">
                Visit time
                <input
                  className="field"
                  name="estimateTime"
                  type="time"
                  defaultValue="10:00"
                  required
                />
              </label>
            </div>
          ) : null}
          <label className="field-label">
            Notes
            <textarea className="field textarea" name="notes" rows={3} />
          </label>
          {error ? <p className="jobs-form-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={saving}>
            {saving
              ? "Saving…"
              : scheduleEstimate
                ? "Schedule quote visit"
                : "Create request"}
          </button>
        </form>
      </div>
    </div>
  );
}
