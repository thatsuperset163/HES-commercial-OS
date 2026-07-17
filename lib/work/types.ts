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
export type RequestStatus = "new" | "contacted" | "quoted" | "closed";
export type TaskStatus = "open" | "done";
export type QuoteStatus = "draft" | "sent" | "won" | "lost";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type ExpenseStatus = "logged" | "paid";

export type WorkClient = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRequest = {
  id: string;
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
  title: string;
  dueDate: string;
  status: TaskStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type QuoteDoc = {
  id: string;
  clientName: string;
  address: string;
  scope: string;
  amount: number | null;
  status: QuoteStatus;
  followUpDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceDoc = {
  id: string;
  clientName: string;
  jobLabel: string;
  amount: number | null;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDoc = {
  id: string;
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
