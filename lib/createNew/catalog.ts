export type CreateNewKind =
  | "job"
  | "request"
  | "quote_visit"
  | "task"
  | "blocked_time"
  | "client"
  | "quote"
  | "invoice"
  | "expense";

export type CreateNewGroup = "schedule" | "record";

export type CreateNewOption = {
  id: CreateNewKind;
  group: CreateNewGroup;
  label: string;
  description: string;
  /** Compact glyph (emoji-free letter mark for a11y-friendly icons). */
  mark: string;
  /** Appears on the Jobs calendar when dated. */
  onCalendar: boolean;
  hrefAfter?: string;
  openLabel?: string;
};

/** Display order within groups follows Jobber-like priority. */
export const CREATE_NEW_OPTIONS: CreateNewOption[] = [
  {
    id: "job",
    group: "schedule",
    label: "Job",
    description: "Schedule approved work",
    mark: "J",
    onCalendar: true,
  },
  {
    id: "request",
    group: "schedule",
    label: "Request",
    description: "Add a new lead or service request",
    mark: "R",
    onCalendar: false,
    hrefAfter: "/work/requests",
    openLabel: "Go to Requests Center",
  },
  {
    id: "quote_visit",
    group: "schedule",
    label: "Quote Visit",
    description: "Schedule an on-site estimate",
    mark: "V",
    onCalendar: true,
  },
  {
    id: "task",
    group: "schedule",
    label: "Task",
    description: "Add a business to-do",
    mark: "T",
    onCalendar: true,
    hrefAfter: "/work/tasks",
    openLabel: "Open Tasks",
  },
  {
    id: "blocked_time",
    group: "schedule",
    label: "Blocked Time",
    description: "Reserve unavailable time",
    mark: "B",
    onCalendar: true,
  },
  {
    id: "client",
    group: "record",
    label: "Client",
    description: "Add a person, company, or property",
    mark: "C",
    onCalendar: false,
    hrefAfter: "/work/clients",
    openLabel: "Open Client",
  },
  {
    id: "quote",
    group: "record",
    label: "Quote",
    description: "Create pricing for requested work",
    mark: "Q",
    onCalendar: false,
    hrefAfter: "/work/quotes",
    openLabel: "Open Quote",
  },
  {
    id: "invoice",
    group: "record",
    label: "Invoice",
    description: "Bill a client for completed work",
    mark: "I",
    onCalendar: false,
    hrefAfter: "/work/invoices",
    openLabel: "Open Invoice",
  },
  {
    id: "expense",
    group: "record",
    label: "Expense",
    description: "Record business spending",
    mark: "E",
    onCalendar: false,
    hrefAfter: "/work/expenses",
    openLabel: "Open Expense",
  },
];

export const CREATE_NEW_GROUPS: {
  id: CreateNewGroup;
  label: string;
}[] = [
  { id: "schedule", label: "Schedule" },
  { id: "record", label: "Create Record" },
];

export function getCreateNewOption(id: CreateNewKind): CreateNewOption {
  const row = CREATE_NEW_OPTIONS.find((o) => o.id === id);
  if (!row) throw new Error(`Unknown create kind: ${id}`);
  return row;
}
