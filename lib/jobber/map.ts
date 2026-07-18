import { todayKey } from "../dates.ts";
import { createJob } from "../jobs/model.ts";
import type { Job } from "../jobs/types.ts";
import { createClient } from "../work/model.ts";
import type { WorkClient } from "../work/types.ts";
import { parseCsv, pickField, rowToObject } from "./csv.ts";

export type ImportPreviewRow = {
  label: string;
  detail: string;
};

export type ClientImportResult = {
  clients: WorkClient[];
  preview: ImportPreviewRow[];
  skipped: number;
};

export type JobImportResult = {
  jobs: Job[];
  clients: WorkClient[];
  preview: ImportPreviewRow[];
  skipped: number;
};

function joinName(first: string, last: string, full: string, company: string): string {
  if (company) return company;
  if (full) return full;
  return [first, last].filter(Boolean).join(" ").trim();
}

function joinAddress(parts: string[]): string {
  return parts.filter(Boolean).join(", ");
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function parseDate(raw: string): string {
  if (!raw) return todayKey();
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const m = us[1].padStart(2, "0");
    const d = us[2].padStart(2, "0");
    return `${us[3]}-${m}-${d}`;
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return todayKey();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function jobStatusFromRow(row: Record<string, string>): Job["status"] {
  const closed = pickField(row, ["closed date", "closed", "completed date"]);
  const statusRaw = pickField(row, ["status", "job status"]).toLowerCase();
  if (closed || statusRaw.includes("complete") || statusRaw.includes("closed")) {
    return "done";
  }
  if (statusRaw.includes("invoice") || statusRaw.includes("paid")) {
    return "invoiced";
  }
  if (statusRaw.includes("cancel")) return "cancelled";
  return "scheduled";
}

export function importClientsFromCsv(csvText: string): ClientImportResult {
  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) {
    return { clients: [], preview: [], skipped: 0 };
  }

  const clients: WorkClient[] = [];
  let skipped = 0;

  for (const rowCells of rows) {
    const row = rowToObject(headers, rowCells);
    const name = joinName(
      pickField(row, ["first name", "given name", "first"]),
      pickField(row, ["last name", "family name", "last"]),
      pickField(row, ["full name", "client", "client name", "name"]),
      pickField(row, ["company name", "company", "organization name", "org"]),
    );
    if (!name) {
      skipped += 1;
      continue;
    }
    const phone = pickField(row, [
      "main phone",
      "mobile phone",
      "phone",
      "client phone",
      "home phone",
      "work phone",
    ]);
    const email = pickField(row, ["email", "client email"]);
    const address = joinAddress([
      pickField(row, ["street", "address", "service street", "billing street"]),
      pickField(row, ["city", "service city", "billing city"]),
      pickField(row, ["state", "province", "service state", "billing state"]),
      pickField(row, [
        "postal code",
        "zip",
        "zip code",
        "service zip",
        "billing zip",
      ]),
    ]);
    const notes = [
      pickField(row, ["lead source", "tags", "notes"]),
      pickField(row, ["billing street"]) && address
        ? ""
        : "",
    ]
      .filter(Boolean)
      .join(" · ");

    clients.push(
      createClient({
        name,
        phone,
        email,
        address,
        notes: notes || `Imported from Jobber`,
      }),
    );
  }

  return {
    clients,
    skipped,
    preview: clients.slice(0, 8).map((client) => ({
      label: client.name,
      detail: [client.phone, client.address].filter(Boolean).join(" · "),
    })),
  };
}

export function importJobsFromCsv(csvText: string): JobImportResult {
  const { headers, rows } = parseCsv(csvText);
  if (!headers.length) {
    return { jobs: [], clients: [], preview: [], skipped: 0 };
  }

  const jobs: Job[] = [];
  const clientMap = new Map<string, WorkClient>();
  let skipped = 0;

  for (const rowCells of rows) {
    const row = rowToObject(headers, rowCells);
    const customerName = pickField(row, [
      "client name",
      "client",
      "customer",
      "company name",
      "full name",
      "name",
    ]);
    if (!customerName) {
      skipped += 1;
      continue;
    }

    const address = joinAddress([
      pickField(row, ["service street", "street", "address", "billing street"]),
      pickField(row, ["service city", "city", "billing city"]),
      pickField(row, [
        "service state",
        "service state/province",
        "state",
        "province",
        "billing state",
      ]),
      pickField(row, [
        "service zip",
        "service zip/postal code",
        "zip",
        "postal code",
        "billing zip",
      ]),
    ]);

    const service =
      pickField(row, ["title", "job title", "line items", "service"]) ||
      "Exterior cleaning";
    const scheduledDate = parseDate(
      pickField(row, [
        "schedule start date",
        "start date",
        "scheduled date",
        "visit date",
        "created date",
      ]),
    );
    const amount = parseAmount(
      pickField(row, [
        "total revenue ($)",
        "total revenue",
        "total ($)",
        "total",
        "amount",
      ]),
    );
    const jobNumber = pickField(row, ["job #", "job number", "job id"]);
    const status = jobStatusFromRow(row);

    const job = createJob({
      customerName,
      address,
      service,
      scheduledDate,
      amount,
      notes: [jobNumber ? `Jobber #${jobNumber}` : "", "Imported from Jobber"]
        .filter(Boolean)
        .join(" · "),
    });
    job.status = status;
    jobs.push(job);

    const key = customerName.toLowerCase();
    if (!clientMap.has(key)) {
      clientMap.set(
        key,
        createClient({
          name: customerName,
          phone: pickField(row, ["client phone", "phone", "mobile phone"]),
          email: pickField(row, ["client email", "email"]),
          address,
          notes: "Imported from Jobber jobs export",
        }),
      );
    }
  }

  return {
    jobs,
    clients: [...clientMap.values()],
    skipped,
    preview: jobs.slice(0, 8).map((job) => ({
      label: job.customerName,
      detail: [job.service, job.scheduledDate, job.status]
        .filter(Boolean)
        .join(" · "),
    })),
  };
}
