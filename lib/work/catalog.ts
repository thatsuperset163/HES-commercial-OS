import type { WorkDeskId } from "./types.ts";

export type WorkDeskField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "tel" | "email";
  required?: boolean;
  placeholder?: string;
};

export type WorkDeskDef = {
  id: WorkDeskId;
  name: string;
  singular: string;
  purpose: string;
  href: string;
  addLabel: string;
  pipelineOrder: number;
  /** Shown on HQ strip */
  hqLabel: string;
  fields: WorkDeskField[];
};

/**
 * Steady Work pipeline destinations.
 * Jobs keeps its dedicated OS; everything else uses WorkDeskApp.
 */
export const WORK_DESKS: WorkDeskDef[] = [
  {
    id: "requests",
    name: "Requests Center",
    singular: "Request",
    purpose: "Intake → estimate → approve → job",
    href: "/work/requests",
    addLabel: "Add request",
    pipelineOrder: 1,
    hqLabel: "Requests",
    fields: [
      { key: "clientName", label: "Who", type: "text", required: true },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "summary", label: "What they want", type: "textarea", required: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "clients",
    name: "Clients",
    singular: "Client",
    purpose: "People and places you work for",
    href: "/work/clients",
    addLabel: "Add client",
    pipelineOrder: 2,
    hqLabel: "Clients",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "email", label: "Email", type: "email" },
      { key: "address", label: "Address", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "quotes",
    name: "Quotes",
    singular: "Quote",
    purpose: "Price the work. Send it. Follow up.",
    href: "/work/quotes",
    addLabel: "Add quote",
    pipelineOrder: 3,
    hqLabel: "Quotes",
    fields: [
      { key: "clientName", label: "Client", type: "text", required: true },
      { key: "address", label: "Property address", type: "text" },
      {
        key: "scope",
        label: "Project overview (This project includes…)",
        type: "textarea",
        required: true,
        placeholder: "Describe the work included in this quote",
      },
      { key: "amount", label: "Pricing ($)", type: "number" },
      { key: "followUpDate", label: "Follow up", type: "date" },
      {
        key: "notes",
        label: "Pricing notes",
        type: "textarea",
        placeholder: "Optional notes shown under Pricing",
      },
    ],
  },
  {
    id: "jobs",
    name: "Jobs",
    singular: "Job",
    purpose: "Schedule → run → done",
    href: "/work/jobs",
    addLabel: "Add job",
    pipelineOrder: 4,
    hqLabel: "Jobs",
    fields: [],
  },
  {
    id: "invoices",
    name: "Invoices",
    singular: "Invoice",
    purpose: "Bill it. Get paid.",
    href: "/work/invoices",
    addLabel: "Add invoice",
    pipelineOrder: 5,
    hqLabel: "Invoices",
    fields: [
      { key: "clientName", label: "Client", type: "text", required: true },
      { key: "jobLabel", label: "For what", type: "text" },
      { key: "amount", label: "Amount ($)", type: "number" },
      { key: "dueDate", label: "Due", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "tasks",
    name: "Tasks",
    singular: "Task",
    purpose: "One-off to-dos that are not a full job",
    href: "/work/tasks",
    addLabel: "Add task",
    pipelineOrder: 6,
    hqLabel: "Tasks",
    fields: [
      { key: "title", label: "Task", type: "text", required: true },
      { key: "dueDate", label: "Due", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  {
    id: "expenses",
    name: "Expenses",
    singular: "Expense",
    purpose: "Track what you spent to run the business",
    href: "/work/expenses",
    addLabel: "Add expense",
    pipelineOrder: 7,
    hqLabel: "Expenses",
    fields: [
      { key: "vendor", label: "Vendor", type: "text", required: true },
      { key: "category", label: "Category", type: "text", placeholder: "Fuel, supplies…" },
      { key: "amount", label: "Amount ($)", type: "number" },
      { key: "date", label: "Date", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
];

export function getWorkDesk(id: WorkDeskId): WorkDeskDef {
  const desk = WORK_DESKS.find((row) => row.id === id);
  if (!desk) throw new Error(`Unknown work desk: ${id}`);
  return desk;
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}
