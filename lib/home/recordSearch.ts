import {
  listClients,
  listInvoices,
  listJobs,
  listQuotes,
  listRequests,
  listTasks,
} from "../storage.ts";
import { jobsDayHref } from "../osNav.ts";

export type RecordSearchHit = {
  id: string;
  type: "client" | "request" | "job" | "quote" | "invoice" | "task";
  typeLabel: string;
  title: string;
  detail: string;
  href: string;
};

const TYPE_ORDER: RecordSearchHit["type"][] = [
  "client",
  "request",
  "job",
  "quote",
  "invoice",
  "task",
];

function hay(...parts: Array<string | undefined | null>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Search blackboard records for global home search. Live local/cloud store only. */
export function searchRecords(query: string, limit = 12): RecordSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: RecordSearchHit[] = [];

  for (const row of listClients()) {
    if (
      !hay(row.name, row.phone, row.email, row.address, row.notes).includes(q)
    ) {
      continue;
    }
    hits.push({
      id: `client-${row.id}`,
      type: "client",
      typeLabel: "Client",
      title: row.name,
      detail: [row.phone, row.address].filter(Boolean).join(" · ") || "Client",
      href: "/work/clients",
    });
  }

  for (const row of listRequests()) {
    if (!hay(row.clientName, row.summary, row.phone, row.notes).includes(q)) {
      continue;
    }
    hits.push({
      id: `request-${row.id}`,
      type: "request",
      typeLabel: "Request",
      title: row.clientName,
      detail: row.summary || row.status,
      href: "/work/requests",
    });
  }

  for (const row of listJobs()) {
    if (
      !hay(
        row.customerName,
        row.companyName,
        row.title,
        row.address,
        row.phone,
        row.email,
        row.service,
        row.notes,
      ).includes(q)
    ) {
      continue;
    }
    hits.push({
      id: `job-${row.id}`,
      type: "job",
      typeLabel: "Job",
      title: row.companyName || row.customerName || row.title || "Job",
      detail: [
        row.service,
        row.scheduledDate
          ? `Scheduled ${row.scheduledDate}${row.startTime ? ` · ${row.startTime}` : ""}`
          : row.status,
      ]
        .filter(Boolean)
        .join(" · "),
      href: row.scheduledDate
        ? jobsDayHref(row.scheduledDate)
        : "/work/jobs",
    });
  }

  for (const row of listQuotes()) {
    if (!hay(row.clientName, row.scope, row.address, row.notes).includes(q)) {
      continue;
    }
    hits.push({
      id: `quote-${row.id}`,
      type: "quote",
      typeLabel: "Quote",
      title: row.clientName,
      detail: row.scope || row.status,
      href: "/work/quotes",
    });
  }

  for (const row of listInvoices()) {
    if (!hay(row.clientName, row.jobLabel, row.notes).includes(q)) continue;
    hits.push({
      id: `invoice-${row.id}`,
      type: "invoice",
      typeLabel: "Invoice",
      title: row.clientName,
      detail: [
        row.amount != null ? `$${Number(row.amount).toLocaleString()}` : null,
        row.status,
        row.dueDate ? `Due ${row.dueDate}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/work/invoices",
    });
  }

  for (const row of listTasks()) {
    if (!hay(row.title, row.notes).includes(q)) continue;
    hits.push({
      id: `task-${row.id}`,
      type: "task",
      typeLabel: "Task",
      title: row.title,
      detail: row.dueDate ? `Due ${row.dueDate}` : row.status,
      href: "/work/tasks",
    });
  }

  hits.sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
  );
  return hits.slice(0, limit);
}

export function groupRecordHits(hits: RecordSearchHit[]) {
  const groups: { type: RecordSearchHit["type"]; typeLabel: string; items: RecordSearchHit[] }[] =
    [];
  for (const type of TYPE_ORDER) {
    const items = hits.filter((h) => h.type === type);
    if (!items.length) continue;
    groups.push({ type, typeLabel: items[0].typeLabel, items });
  }
  return groups;
}
