import type { Job } from "./jobs/types";
import type { ClientLinkFlag } from "./clients/resolver";
import type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkTask,
} from "./work/types";

export type { Job, JobStatus, JobInput } from "./jobs/types";
export type {
  ExpenseDoc,
  InvoiceDoc,
  QuoteDoc,
  ServiceRequest,
  WorkClient,
  WorkDeskId,
  WorkTask,
} from "./work/types";
export type { ClientLinkFlag } from "./clients/resolver";

export type MetricKey =
  | "doors"
  | "conversations"
  | "phoneNumbers"
  | "quotes"
  | "jobsBooked";

export type Metrics = Record<MetricKey, number>;

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type ChecklistKey =
  | "dailyChecklist"
  | "morningWorkChecklist"
  | "afternoonWorkChecklist"
  | "outreach";

export type GoalItem = {
  id: string;
  text: string;
  done: boolean;
  category: "personal" | "business";
};

/** @deprecated old form-style outreach — migrated in normalizeDayEntry */
export type OutreachTarget = {
  id: string;
  name: string;
  note: string;
  done: boolean;
};

export type DayEntry = {
  date: string; // YYYY-MM-DD
  dailyChecklist: ChecklistItem[];
  morningWorkChecklist: ChecklistItem[];
  afternoonWorkChecklist: ChecklistItem[];
  /** @deprecated migrated into morningWorkChecklist */
  morningChecklist?: ChecklistItem[];
  outreach: ChecklistItem[];
  /** Find-work hunt coach checklist for this calendar day. */
  huntChecklist?: ChecklistItem[];
  goals: GoalItem[];
  metrics: Metrics;
  notes: string;
  personalNotes: string;
  updatedAt: string;
};

export type BoardStore = {
  days: Record<string, DayEntry>;
  /** Jobs OS entities — synced with blackboard cloud state. */
  jobs: Job[];
  clients: WorkClient[];
  requests: ServiceRequest[];
  tasks: WorkTask[];
  quotes: QuoteDoc[];
  invoices: InvoiceDoc[];
  expenses: ExpenseDoc[];
  /**
   * Records that could not be safely auto-linked to a Client during backfill.
   * Never auto-resolved — requires intentional review.
   */
  clientLinkFlags?: ClientLinkFlag[];
  /** ADHD idea parking lot — capture distractions without switching tasks. */
  ideaLot?: string;
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  doors: "Doors",
  conversations: "Conversations",
  phoneNumbers: "Phone #s",
  quotes: "Quotes",
  jobsBooked: "Jobs booked",
};

export const EMPTY_METRICS: Metrics = {
  doors: 0,
  conversations: 0,
  phoneNumbers: 0,
  quotes: 0,
  jobsBooked: 0,
};
