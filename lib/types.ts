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
  goals: GoalItem[];
  metrics: Metrics;
  notes: string;
  personalNotes: string;
  updatedAt: string;
};

export type BoardStore = {
  days: Record<string, DayEntry>;
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
