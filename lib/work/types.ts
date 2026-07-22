/** Work pipeline entities — live under /work, surfaced on HQ. */

export type WorkDeskId =
  | "clients"
  | "requests"
  | "tasks"
  | "quotes"
  | "jobs"
  | "invoices"
  | "expenses";

export type ClientStatus = "active" | "paused";
export type ClientType = "residential" | "commercial";
export type PreferredContact = "phone" | "email" | "text" | "";
export type RequestStatus = "new" | "contacted" | "quoted" | "closed";
export type TaskStatus = "open" | "done";
export type QuoteStatus = "draft" | "sent" | "won" | "lost";
/** Distinguishes intentional extra quotes for the same request. */
export type QuoteKind = "primary" | "revised" | "alternate" | "additional";
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "void";
export type ExpenseStatus = "logged" | "paid";

export type InvoicePaymentMethod =
  | "cash"
  | "check"
  | "card"
  | "ach"
  | "other";

export type InvoiceLineItem = {
  id: string;
  description: string;
  quantity: number;
  rate: number;
};

export type InvoicePayment = {
  id: string;
  date: string;
  amount: number;
  method: InvoicePaymentMethod;
  note: string;
};

/** Extra property / site for a client (primary lives in `address`). */
export type ClientProperty = {
  id: string;
  /** Optional label e.g. Home, Shop, Warehouse */
  label: string;
  line: string;
};

export type WorkClient = {
  id: string;
  name: string;
  /** Company / DBA when different from display name */
  companyName: string;
  phone: string;
  email: string;
  /** Primary property address (shown in directory). */
  address: string;
  billingAddress: string;
  /** Additional properties beyond the primary address. */
  properties: ClientProperty[];
  city: string;
  clientType: ClientType;
  preferredContact: PreferredContact;
  tags: string[];
  favorite: boolean;
  notes: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * @deprecated LEGACY blackboard desk request (New / Contacted / Quoted / Closed).
 * Live Requests OS uses Supabase `intake_requests` (`IntakeRequest`).
 * Do not surface these on HQ Home. Keep for migration / historical read only.
 */
export type ServiceRequest = {
  id: string;
  /** Stable WorkClient id when known. */
  clientId: string;
  clientName: string;
  summary: string;
  phone: string;
  status: RequestStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkTask = {
  id: string;
  /** Stable WorkClient id when this task belongs to a client. */
  clientId: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteDoc = {
  id: string;
  /** Human-readable number e.g. Q-2026-0007 (separate from id). */
  number: string;
  clientName: string;
  companyName: string;
  /** Stable WorkClient id when known. */
  clientId: string;
  /** Originating intake request id when created from Requests OS. */
  requestId: string;
  /** Linked job id after Create Job from an approved quote. */
  jobId: string;
  /** Linked invoice id when one exists. */
  invoiceId: string;
  phone: string;
  email: string;
  address: string;
  billingAddress: string;
  scope: string;
  amount: number | null;
  status: QuoteStatus;
  followUpDate: string;
  /** ISO timestamp when marked sent (empty when never sent). */
  sentAt: string;
  quoteKind: QuoteKind;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDoc = {
  id: string;
  /** Human-readable number e.g. INV-2026-0007 (separate from id). */
  number: string;
  clientName: string;
  companyName: string;
  /** Stable WorkClient id when known. */
  clientId: string;
  billingAddress: string;
  serviceAddress: string;
  jobLabel: string;
  jobId: string;
  quoteId: string;
  requestId: string;
  lineItems: InvoiceLineItem[];
  /**
   * Legacy single total. Used when lineItems is empty so older records
   * still round-trip. Prefer lineItems for new documents.
   */
  amount: number | null;
  discount: number;
  /** Tax percent (e.g. 0 or 7.5). */
  taxRate: number;
  payments: InvoicePayment[];
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paymentTerms: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDoc = {
  id: string;
  /** Stable WorkClient id when this expense is client-attributed. */
  clientId: string;
  vendor: string;
  category: string;
  amount: number | null;
  date: string;
  status: ExpenseStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkRecord =
  | WorkClient
  | ServiceRequest
  | WorkTask
  | QuoteDoc
  | InvoiceDoc
  | ExpenseDoc;
