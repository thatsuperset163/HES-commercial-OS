"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatDisplayDate, todayKey } from "@/lib/dates";
import {
  CREATE_NEW_GROUPS,
  CREATE_NEW_OPTIONS,
  getCreateNewOption,
  type CreateNewKind,
} from "@/lib/createNew/catalog";
import {
  blockedTimeDefaults,
  quoteVisitDefaults,
} from "@/lib/createNew/scheduleOverlays";
import type { Job, JobInput } from "@/lib/jobs/types";
import CreateNewMenu from "./CreateNewMenu";
import CreateRecordModal from "./CreateRecordModal";
import CreateRequestModal from "./CreateRequestModal";
import "./create-new.css";

type DeskKind = "clients" | "quotes" | "invoices" | "tasks" | "expenses";

type SuccessBanner = {
  message: string;
  href?: string;
  openLabel?: string;
} | null;

export type CreateContext = {
  dateKey: string;
  startTime?: string;
};

export type ClientCreatePrefill = {
  id: string;
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
};

type Props = {
  size?: "default" | "small";
  label?: string;
  className?: string;
  /** Open a date-scoped chooser (e.g. empty calendar cell). */
  context?: CreateContext | null;
  onContextHandled?: () => void;
  /** When set (e.g. from a client profile), new records prefill this client. */
  clientPrefill?: ClientCreatePrefill | null;
  onOpenJobForm: (initial: Partial<Job>) => void;
  /** Persist a job without opening the editor (quote-visit calendar block). */
  onQuickCreateJob?: (input: JobInput) => Promise<void> | void;
  onCreated?: (kind: CreateNewKind) => void;
};

export default function CreateNewController({
  size = "small",
  label = "Create New",
  className,
  context = null,
  onContextHandled,
  clientPrefill = null,
  onOpenJobForm,
  onQuickCreateJob,
  onCreated,
}: Props) {
  const [desk, setDesk] = useState<DeskKind | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [quoteVisitOpen, setQuoteVisitOpen] = useState(false);
  const [picker, setPicker] = useState<CreateContext | null>(null);
  const [contextDate, setContextDate] = useState(todayKey());
  const [contextTime, setContextTime] = useState("09:00");
  const [banner, setBanner] = useState<SuccessBanner>(null);

  useEffect(() => {
    if (context) {
      setPicker(context);
      setContextDate(context.dateKey);
      setContextTime(context.startTime || "09:00");
    }
  }, [context]);

  const showBanner = useCallback((next: SuccessBanner) => {
    setBanner(next);
    window.setTimeout(() => setBanner(null), 5000);
  }, []);

  const closePicker = () => {
    setPicker(null);
    onContextHandled?.();
  };

  const handleSelect = useCallback(
    (kind: CreateNewKind, dateKey?: string, startTime?: string) => {
      const date = dateKey || contextDate || todayKey();
      const time = startTime || contextTime || "09:00";
      setContextDate(date);
      setContextTime(time);
      closePicker();

      if (kind === "job") {
        onOpenJobForm({
          scheduledDate: date,
          startTime: time,
          status: "scheduled",
          ...(clientPrefill
            ? {
                customerId: clientPrefill.id,
                customerName: clientPrefill.name,
                companyName: clientPrefill.companyName || "",
                phone: clientPrefill.phone || "",
                email: clientPrefill.email || "",
                address: clientPrefill.address || "",
              }
            : {}),
        });
        return;
      }
      if (kind === "quote_visit") {
        setQuoteVisitOpen(true);
        return;
      }
      if (kind === "blocked_time") {
        onOpenJobForm(blockedTimeDefaults(date, time));
        return;
      }
      if (kind === "request") {
        setRequestOpen(true);
        return;
      }
      if (kind === "task") {
        setDesk("tasks");
        return;
      }
      if (kind === "client") {
        setDesk("clients");
        return;
      }
      if (kind === "quote") {
        const params = new URLSearchParams({ new: "1" });
        if (clientPrefill?.name) params.set("clientName", clientPrefill.name);
        if (clientPrefill?.address) params.set("address", clientPrefill.address);
        window.location.assign(`/work/quotes?${params.toString()}`);
        return;
      }
      if (kind === "invoice") {
        setDesk("invoices");
        return;
      }
      if (kind === "expense") {
        setDesk("expenses");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contextDate, contextTime, onOpenJobForm, clientPrefill],
  );

  const recordDefaults = clientPrefill
    ? {
        clientName: clientPrefill.name,
        address: clientPrefill.address || "",
        title: `Follow up · ${clientPrefill.name}`,
      }
    : undefined;

  const requestClient = clientPrefill
    ? ({
        id: clientPrefill.id,
        name: clientPrefill.name,
        companyName: clientPrefill.companyName || "",
        phone: clientPrefill.phone || "",
        email: clientPrefill.email || "",
        address: clientPrefill.address || "",
        billingAddress: "",
        properties: [],
        city: "",
        clientType: "residential" as const,
        preferredContact: "" as const,
        tags: [],
        favorite: false,
        notes: "",
        status: "active" as const,
        createdAt: "",
        updatedAt: "",
      })
    : null;

  return (
    <>
      <CreateNewMenu
        label={label}
        size={size}
        className={className}
        onSelect={(kind) => handleSelect(kind, todayKey(), "09:00")}
      />

      {picker ? (
        <div className="modal-backdrop" role="presentation" onClick={closePicker}>
          <div
            className="modal-card create-day-picker"
            role="dialog"
            aria-label="Create on date"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="hq-eyebrow">Create New</p>
                <h2 className="panel-title">{formatDisplayDate(picker.dateKey)}</h2>
              </div>
              <button type="button" className="btn ghost small" onClick={closePicker}>
                Close
              </button>
            </div>
            <p className="create-day-lede">
              What do you want to add on this day?
            </p>
            {CREATE_NEW_GROUPS.map((group) => (
              <div key={group.id} className="create-new-group">
                <p className="create-new-group-label">{group.label}</p>
                <ul className="create-new-list">
                  {CREATE_NEW_OPTIONS.filter((o) => o.group === group.id).map(
                    (option) => (
                      <li key={option.id}>
                        <button
                          type="button"
                          className="create-new-item"
                          onClick={() =>
                            handleSelect(
                              option.id,
                              picker.dateKey,
                              picker.startTime,
                            )
                          }
                        >
                          <span
                            className={`create-new-mark kind-${option.id}`}
                            aria-hidden
                          >
                            {option.mark}
                          </span>
                          <span className="create-new-copy">
                            <strong>{option.label}</strong>
                          </span>
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {desk ? (
        <CreateRecordModal
          open
          deskId={desk}
          defaultDate={contextDate}
          defaultValues={recordDefaults}
          onClose={() => setDesk(null)}
          onCreated={(result) => {
            const option = getCreateNewOption(
              desk === "clients"
                ? "client"
                : desk === "quotes"
                  ? "quote"
                  : desk === "invoices"
                    ? "invoice"
                    : desk === "tasks"
                      ? "task"
                      : "expense",
            );
            showBanner({
              message: `${option.label} created: ${result.title}`,
              href: result.href,
              openLabel: result.openLabel,
            });
            onCreated?.(option.id);
          }}
        />
      ) : null}

      <CreateRequestModal
        open={requestOpen}
        defaultDate={contextDate}
        defaultClient={requestClient}
        onClose={() => setRequestOpen(false)}
        onCreated={(result) => {
          showBanner({
            message: `Request created: ${result.request.customerName}`,
            href: result.href,
            openLabel: result.openLabel,
          });
          onCreated?.("request");
        }}
      />

      <CreateRequestModal
        open={quoteVisitOpen}
        defaultDate={contextDate}
        defaultClient={requestClient}
        scheduleEstimate
        onClose={() => setQuoteVisitOpen(false)}
        onCreated={async (result) => {
          showBanner({
            message: `Quote visit scheduled: ${result.request.customerName}`,
            href: result.href,
            openLabel: result.openLabel,
          });
          const visit = quoteVisitDefaults(
            result.request.estimateDate || contextDate,
            result.request.estimateTime || contextTime,
          );
          try {
            await onQuickCreateJob?.({
              customerName: result.request.customerName,
              companyName: result.request.company,
              phone: result.request.phone,
              email: result.request.email,
              address: result.request.address,
              requestId: result.request.id,
              service: visit.service,
              title: visit.title,
              description: result.request.serviceRequested,
              scheduledDate: visit.scheduledDate,
              startTime: visit.startTime,
              estimatedDurationMinutes: visit.estimatedDurationMinutes,
              status: "scheduled",
            });
          } catch {
            // Banner already shown for request; job block is best-effort.
          }
          onCreated?.("quote_visit");
        }}
      />

      {banner ? (
        <div className="create-new-banner" role="status">
          <span>{banner.message}</span>
          {banner.href && banner.openLabel ? (
            <Link href={banner.href} className="hq-link">
              {banner.openLabel} →
            </Link>
          ) : null}
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </>
  );
}
