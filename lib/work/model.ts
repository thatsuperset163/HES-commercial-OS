import {
  findExistingClient,
  logClientEvent,
  stableClientFingerprint,
  type ClientIdentityInput,
} from "../clients/identity.ts";
import { todayKey } from "../dates.ts";
import type {
  ClientProperty,
  ClientStatus,
  ClientType,
  ExpenseDoc,
  ExpenseStatus,
  InvoiceDoc,
  InvoiceStatus,
  PreferredContact,
  QuoteDoc,
  QuoteStatus,
  RequestStatus,
  ServiceRequest,
  TaskStatus,
  WorkClient,
  WorkTask,
} from "./types.ts";

export function workUid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  return null;
}

function pickStatus<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export type CreateClientInput = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  companyName?: string;
  billingAddress?: string;
  city?: string;
  clientType?: ClientType;
  preferredContact?: PreferredContact;
  tags?: string[];
  favorite?: boolean;
};

/** Pure factory — always builds a new in-memory client. Prefer findOrCreateClient. */
export function createClient(input: CreateClientInput): WorkClient {
  const now = new Date().toISOString();
  return {
    id: workUid("client"),
    name: input.name.trim() || "Client",
    companyName: (input.companyName ?? "").trim(),
    phone: (input.phone ?? "").trim(),
    email: (input.email ?? "").trim(),
    address: (input.address ?? "").trim(),
    billingAddress: (input.billingAddress ?? "").trim(),
    properties: [],
    city: (input.city ?? "").trim(),
    clientType: input.clientType === "commercial" ? "commercial" : "residential",
    preferredContact: input.preferredContact ?? "",
    tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
    favorite: Boolean(input.favorite),
    notes: (input.notes ?? "").trim(),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export type FindOrCreateClientResult = {
  client: WorkClient;
  created: boolean;
  reason: string;
};

/**
 * Reuse an existing client when identity matches. Only mint a new record when
 * no match is found. This is the only safe entry point for inserts.
 */
export function findOrCreateClient(
  existing: WorkClient[],
  input: CreateClientInput,
  source = "unspecified",
): FindOrCreateClientResult {
  logClientEvent("create_request_start", {
    source,
    name: input.name,
    email: input.email ?? "",
    phone: input.phone ?? "",
  });

  const identity: ClientIdentityInput = {
    name: input.name,
    companyName: input.companyName,
    phone: input.phone,
    email: input.email,
    address: input.address,
  };
  const match = findExistingClient(existing, identity);
  if (match) {
    logClientEvent("reused_existing", {
      source,
      existingId: match.client.id,
      reason: match.reason,
      name: match.client.name,
    });
    return {
      client: match.client,
      created: false,
      reason: `reused_by_${match.reason}`,
    };
  }

  const client = createClient(input);
  logClientEvent("created_new", {
    source,
    id: client.id,
    reason: "no_identity_match",
    name: client.name,
  });
  return { client, created: true, reason: "no_identity_match" };
}

function normalizeProperty(row: unknown): ClientProperty | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const line = asString(rec.line || rec.address).trim();
  if (!line) return null;
  return {
    id: asString(rec.id) || workUid("prop"),
    label: asString(rec.label).trim(),
    line,
  };
}

export function addClientProperty(
  client: WorkClient,
  input: { line: string; label?: string },
): WorkClient {
  const line = input.line.trim();
  if (!line) return client;
  const property: ClientProperty = {
    id: workUid("prop"),
    label: (input.label ?? "").trim(),
    line,
  };
  // If they have no primary yet, first added address becomes primary.
  if (!client.address.trim()) {
    return {
      ...client,
      address: line,
      properties: client.properties ?? [],
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    ...client,
    properties: [...(client.properties ?? []), property],
    updatedAt: new Date().toISOString(),
  };
}

export function removeClientProperty(
  client: WorkClient,
  propertyId: string,
): WorkClient {
  return {
    ...client,
    properties: (client.properties ?? []).filter((p) => p.id !== propertyId),
    updatedAt: new Date().toISOString(),
  };
}

export function setClientPrimaryAddress(
  client: WorkClient,
  line: string,
): WorkClient {
  const next = line.trim();
  const prev = client.address.trim();
  if (!next || next === prev) {
    return { ...client, address: next, updatedAt: new Date().toISOString() };
  }
  // Keep the old primary as an additional property when it still has content.
  const properties = [...(client.properties ?? [])];
  if (prev && !properties.some((p) => p.line === prev)) {
    properties.unshift({
      id: workUid("prop"),
      label: "Previous primary",
      line: prev,
    });
  }
  return {
    ...client,
    address: next,
    properties: properties.filter((p) => p.line !== next),
    updatedAt: new Date().toISOString(),
  };
}

export function createRequest(input: {
  clientName: string;
  summary: string;
  phone?: string;
  notes?: string;
}): ServiceRequest {
  const now = new Date().toISOString();
  return {
    id: workUid("req"),
    clientName: input.clientName.trim() || "Lead",
    summary: input.summary.trim() || "New request",
    phone: (input.phone ?? "").trim(),
    status: "new",
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createTask(input: {
  title: string;
  dueDate?: string;
  notes?: string;
}): WorkTask {
  const now = new Date().toISOString();
  return {
    id: workUid("task"),
    title: input.title.trim() || "Task",
    dueDate: input.dueDate?.trim() || todayKey(),
    status: "open",
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createQuote(input: {
  clientName: string;
  address?: string;
  scope?: string;
  amount?: number | null;
  followUpDate?: string;
  notes?: string;
}): QuoteDoc {
  const now = new Date().toISOString();
  return {
    id: workUid("quote"),
    clientName: input.clientName.trim() || "Client",
    address: (input.address ?? "").trim(),
    scope: (input.scope ?? "").trim() || "Exterior cleaning",
    amount:
      input.amount === undefined || input.amount === null || Number.isNaN(input.amount)
        ? null
        : Math.max(0, Number(input.amount)),
    status: "draft",
    followUpDate: input.followUpDate?.trim() || todayKey(),
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createInvoice(input: {
  clientName: string;
  jobLabel?: string;
  amount?: number | null;
  dueDate?: string;
  notes?: string;
}): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id: workUid("inv"),
    clientName: input.clientName.trim() || "Client",
    jobLabel: (input.jobLabel ?? "").trim() || "Completed work",
    amount:
      input.amount === undefined || input.amount === null || Number.isNaN(input.amount)
        ? null
        : Math.max(0, Number(input.amount)),
    status: "draft",
    dueDate: input.dueDate?.trim() || todayKey(),
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createExpense(input: {
  vendor: string;
  category?: string;
  amount?: number | null;
  date?: string;
  notes?: string;
}): ExpenseDoc {
  const now = new Date().toISOString();
  return {
    id: workUid("exp"),
    vendor: input.vendor.trim() || "Vendor",
    category: (input.category ?? "").trim() || "Supplies",
    amount:
      input.amount === undefined || input.amount === null || Number.isNaN(input.amount)
        ? null
        : Math.max(0, Number(input.amount)),
    date: input.date?.trim() || todayKey(),
    status: "logged",
    notes: (input.notes ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeClients(value: unknown): WorkClient[] {
  if (!Array.isArray(value)) return [];
  const statuses: ClientStatus[] = ["active", "paused"];
  const types: ClientType[] = ["residential", "commercial"];
  const prefs: PreferredContact[] = ["phone", "email", "text", ""];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => {
      const rawProps = Array.isArray(row.properties) ? row.properties : [];
      const properties = rawProps
        .map(normalizeProperty)
        .filter((p): p is ClientProperty => Boolean(p));
      const tags = Array.isArray(row.tags)
        ? row.tags.map((t) => asString(t).trim()).filter(Boolean)
        : [];
      const address = asString(row.address);
      const name = asString(row.name).trim() || "Client";
      const companyName = asString(row.companyName);
      const phone = asString(row.phone);
      const email = asString(row.email);
      // Never mint a random id on normalize — that duplicates clients on every
      // hydrate/merge when id was missing. Use a stable fingerprint instead.
      const id =
        asString(row.id) ||
        stableClientFingerprint({
          name,
          companyName,
          phone,
          email,
          address,
        });
      return {
        id,
        name,
        companyName,
        phone,
        email,
        address,
        billingAddress: asString(row.billingAddress),
        properties,
        city: asString(row.city) || guessCity(address),
        clientType: pickStatus(row.clientType, types, "residential"),
        preferredContact: pickStatus(
          row.preferredContact,
          prefs,
          "",
        ) as PreferredContact,
        tags,
        favorite: Boolean(row.favorite),
        notes: asString(row.notes),
        status: pickStatus(row.status, statuses, "active"),
        createdAt: asString(row.createdAt) || new Date().toISOString(),
        updatedAt: asString(row.updatedAt) || new Date().toISOString(),
      };
    });
}

function guessCity(address: string): string {
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2] || "";
  return "";
}

export function normalizeRequests(value: unknown): ServiceRequest[] {
  if (!Array.isArray(value)) return [];
  const statuses: RequestStatus[] = ["new", "contacted", "quoted", "closed"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || workUid("req"),
      clientName: asString(row.clientName).trim() || "Lead",
      summary: asString(row.summary).trim() || "Request",
      phone: asString(row.phone),
      status: pickStatus(row.status, statuses, "new"),
      notes: asString(row.notes),
      createdAt: asString(row.createdAt) || new Date().toISOString(),
      updatedAt: asString(row.updatedAt) || new Date().toISOString(),
    }));
}

export function normalizeTasks(value: unknown): WorkTask[] {
  if (!Array.isArray(value)) return [];
  const statuses: TaskStatus[] = ["open", "done"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || workUid("task"),
      title: asString(row.title).trim() || "Task",
      dueDate: asString(row.dueDate) || todayKey(),
      status: pickStatus(row.status, statuses, "open"),
      notes: asString(row.notes),
      createdAt: asString(row.createdAt) || new Date().toISOString(),
      updatedAt: asString(row.updatedAt) || new Date().toISOString(),
    }));
}

export function normalizeQuotes(value: unknown): QuoteDoc[] {
  if (!Array.isArray(value)) return [];
  const statuses: QuoteStatus[] = ["draft", "sent", "won", "lost"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || workUid("quote"),
      clientName: asString(row.clientName).trim() || "Client",
      address: asString(row.address),
      scope: asString(row.scope).trim() || "Exterior cleaning",
      amount: asAmount(row.amount),
      status: pickStatus(row.status, statuses, "draft"),
      followUpDate: asString(row.followUpDate) || todayKey(),
      notes: asString(row.notes),
      createdAt: asString(row.createdAt) || new Date().toISOString(),
      updatedAt: asString(row.updatedAt) || new Date().toISOString(),
    }));
}

export function normalizeInvoices(value: unknown): InvoiceDoc[] {
  if (!Array.isArray(value)) return [];
  const statuses: InvoiceStatus[] = ["draft", "sent", "paid", "overdue"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || workUid("inv"),
      clientName: asString(row.clientName).trim() || "Client",
      jobLabel: asString(row.jobLabel).trim() || "Completed work",
      amount: asAmount(row.amount),
      status: pickStatus(row.status, statuses, "draft"),
      dueDate: asString(row.dueDate) || todayKey(),
      notes: asString(row.notes),
      createdAt: asString(row.createdAt) || new Date().toISOString(),
      updatedAt: asString(row.updatedAt) || new Date().toISOString(),
    }));
}

export function normalizeExpenses(value: unknown): ExpenseDoc[] {
  if (!Array.isArray(value)) return [];
  const statuses: ExpenseStatus[] = ["logged", "paid"];
  return value
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => ({
      id: asString(row.id) || workUid("exp"),
      vendor: asString(row.vendor).trim() || "Vendor",
      category: asString(row.category).trim() || "Supplies",
      amount: asAmount(row.amount),
      date: asString(row.date) || todayKey(),
      status: pickStatus(row.status, statuses, "logged"),
      notes: asString(row.notes),
      createdAt: asString(row.createdAt) || new Date().toISOString(),
      updatedAt: asString(row.updatedAt) || new Date().toISOString(),
    }));
}

export function mergeByUpdatedAt<T extends { id: string; updatedAt: string }>(
  local: T[],
  cloud: T[],
): T[] {
  const map = new Map<string, T>();
  for (const row of local) map.set(row.id, row);
  for (const row of cloud) {
    const existing = map.get(row.id);
    if (!existing || (row.updatedAt ?? "") >= (existing.updatedAt ?? "")) {
      map.set(row.id, row);
    }
  }
  return [...map.values()].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export function advanceClientStatus(row: WorkClient): WorkClient {
  const next: Record<ClientStatus, ClientStatus | null> = {
    active: "paused",
    paused: "active",
  };
  const status = next[row.status];
  if (!status) return row;
  return { ...row, status, updatedAt: new Date().toISOString() };
}

export function advanceRequestStatus(row: ServiceRequest): ServiceRequest {
  const next: Record<RequestStatus, RequestStatus | null> = {
    new: "contacted",
    contacted: "quoted",
    quoted: "closed",
    closed: null,
  };
  const status = next[row.status];
  if (!status) return row;
  return { ...row, status, updatedAt: new Date().toISOString() };
}

export function advanceTaskStatus(row: WorkTask): WorkTask {
  if (row.status === "done") return row;
  return { ...row, status: "done", updatedAt: new Date().toISOString() };
}

export function advanceQuoteStatus(row: QuoteDoc): QuoteDoc {
  const next: Record<QuoteStatus, QuoteStatus | null> = {
    draft: "sent",
    sent: "won",
    won: null,
    lost: null,
  };
  const status = next[row.status];
  if (!status) return row;
  return { ...row, status, updatedAt: new Date().toISOString() };
}

export function advanceInvoiceStatus(row: InvoiceDoc): InvoiceDoc {
  const next: Record<InvoiceStatus, InvoiceStatus | null> = {
    draft: "sent",
    sent: "paid",
    overdue: "paid",
    paid: null,
  };
  const status = next[row.status];
  if (!status) return row;
  return { ...row, status, updatedAt: new Date().toISOString() };
}

export function advanceExpenseStatus(row: ExpenseDoc): ExpenseDoc {
  if (row.status === "paid") return row;
  return { ...row, status: "paid", updatedAt: new Date().toISOString() };
}

export function markQuoteLost(row: QuoteDoc): QuoteDoc {
  if (row.status === "lost" || row.status === "won") return row;
  return { ...row, status: "lost", updatedAt: new Date().toISOString() };
}
