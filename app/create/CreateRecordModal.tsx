"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { todayKey } from "@/lib/dates";
import { getWorkDesk } from "@/lib/work/catalog";
import {
  createClient,
  createExpense,
  createInvoice,
  createQuote,
  createTask,
} from "@/lib/work/model";
import type { WorkDeskId } from "@/lib/work/types";
import {
  hydrateStoreFromCloud,
  upsertClient,
  upsertExpense,
  upsertInvoice,
  upsertQuote,
  upsertTask,
} from "@/lib/storage";

type DeskKind = Exclude<WorkDeskId, "jobs" | "requests">;

type Props = {
  open: boolean;
  deskId: DeskKind;
  /** Prefill date-ish fields (dueDate / followUpDate / date). */
  defaultDate?: string;
  /** Prefill named fields (e.g. clientName from a client profile). */
  defaultValues?: Record<string, string>;
  onClose: () => void;
  onCreated: (result: {
    id: string;
    title: string;
    href: string;
    openLabel: string;
  }) => void;
};

const OPEN_LABEL: Record<DeskKind, string> = {
  clients: "Open Client",
  quotes: "Open Quote",
  invoices: "Open Invoice",
  tasks: "Open Tasks",
  expenses: "Open Expense",
};

export default function CreateRecordModal({
  open,
  deskId,
  defaultDate,
  defaultValues,
  onClose,
  onCreated,
}: Props) {
  const desk = getWorkDesk(deskId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const date = defaultDate || todayKey();

  const defaults = useMemo(() => {
    const map: Record<string, string> = { ...(defaultValues || {}) };
    for (const field of desk.fields) {
      if (field.type === "date" && !map[field.key]) map[field.key] = date;
    }
    return map;
  }, [desk.fields, date, defaultValues]);

  useEffect(() => {
    if (open) {
      setError(null);
      void hydrateStoreFromCloud();
    }
  }, [open]);

  if (!open) return null;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of desk.fields) {
      values[field.key] = String(fd.get(field.key) || "").trim();
    }
    setSaving(true);
    setError(null);
    try {
      let id = "";
      let title = "";
      if (deskId === "clients") {
        if (!values.name) throw new Error("Name is required");
        const row = createClient({
          name: values.name,
          phone: values.phone,
          email: values.email,
          address: values.address,
          notes: values.notes,
        });
        upsertClient(row);
        id = row.id;
        title = row.name;
      } else if (deskId === "quotes") {
        if (!values.clientName || !values.scope) {
          throw new Error("Client and scope are required");
        }
        const row = createQuote({
          clientName: values.clientName,
          address: values.address,
          scope: values.scope,
          followUpDate: values.followUpDate,
          notes: values.notes,
          amount: values.amount ? Number(values.amount) : null,
        });
        upsertQuote(row);
        id = row.id;
        title = row.clientName;
      } else if (deskId === "invoices") {
        if (!values.clientName) throw new Error("Client is required");
        const row = createInvoice({
          clientName: values.clientName,
          jobLabel: values.jobLabel,
          dueDate: values.dueDate,
          notes: values.notes,
          amount: values.amount ? Number(values.amount) : null,
        });
        upsertInvoice(row);
        id = row.id;
        title = row.clientName;
      } else if (deskId === "tasks") {
        if (!values.title) throw new Error("Task title is required");
        const row = createTask({
          title: values.title,
          dueDate: values.dueDate,
          notes: values.notes,
        });
        upsertTask(row);
        id = row.id;
        title = row.title;
      } else if (deskId === "expenses") {
        if (!values.vendor) throw new Error("Vendor is required");
        const payment = String(fd.get("paymentMethod") || "").trim();
        const jobLink = String(fd.get("jobLink") || "").trim();
        const notes = [
          values.notes,
          payment && `Payment: ${payment}`,
          jobLink && `Job: ${jobLink}`,
        ]
          .filter(Boolean)
          .join(" · ");
        const row = createExpense({
          vendor: values.vendor,
          category: values.category,
          date: values.date,
          notes,
          amount: values.amount ? Number(values.amount) : null,
        });
        upsertExpense(row);
        id = row.id;
        title = row.vendor;
      } else {
        throw new Error("Unsupported record type");
      }

      onCreated({
        id,
        title,
        href: desk.href,
        openLabel: OPEN_LABEL[deskId],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card create-record-modal"
        role="dialog"
        aria-label={`Create ${desk.singular}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 className="panel-title">New {desk.singular.toLowerCase()}</h2>
          <button type="button" className="btn ghost small" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="jobs-form" onSubmit={onSubmit}>
          {desk.fields.map((field) => (
            <label key={field.key} className="field-label">
              {field.label}
              {field.required ? " *" : ""}
              {field.type === "textarea" ? (
                <textarea
                  className="field textarea"
                  name={field.key}
                  rows={3}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={defaults[field.key] || ""}
                />
              ) : (
                <input
                  className="field"
                  name={field.key}
                  type={field.type}
                  required={field.required}
                  placeholder={field.placeholder}
                  defaultValue={defaults[field.key] || ""}
                  autoFocus={field.required}
                />
              )}
            </label>
          ))}
          {deskId === "expenses" ? (
            <>
              <label className="field-label">
                Payment method
                <input
                  className="field"
                  name="paymentMethod"
                  placeholder="Cash, card, account…"
                />
              </label>
              <label className="field-label">
                Linked job (optional)
                <input
                  className="field"
                  name="jobLink"
                  placeholder="Job name or id"
                />
              </label>
            </>
          ) : null}
          {error ? <p className="jobs-form-error">{error}</p> : null}
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? "Saving…" : `Create ${desk.singular.toLowerCase()}`}
          </button>
        </form>
      </div>
    </div>
  );
}
