export const INTAKE_STATUSES = [
  "new",
  "needs_response",
  "estimate_scheduled",
  "waiting_on_customer",
  "approved",
  "declined",
] as const;

export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type IntakePriority = (typeof INTAKE_PRIORITIES)[number];

export const REQUEST_SOURCES = [
  "website",
  "phone",
  "text",
  "email",
  "referral",
  "door",
  "commercial",
  "manual",
  "other",
] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const WAITING_REASONS = [
  "Waiting for approval",
  "Waiting for access",
  "Waiting for HOA",
  "Waiting on insurance",
  "Waiting for photos",
  "Other",
] as const;

export const DECLINE_REASONS = [
  "Too expensive",
  "Competitor",
  "No response",
  "Not interested",
  "Other",
] as const;

export type IntakeAttachment = {
  id: string;
  name: string;
  url: string;
  kind: "file" | "photo";
  addedAt: string;
};

export type IntakeActivity = {
  id: string;
  requestId: string;
  activityType: string;
  body: string;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type IntakeRequest = {
  id: string;
  status: IntakeStatus;
  customerName: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  serviceRequested: string;
  requestSource: RequestSource;
  priority: IntakePriority;
  notes: string;
  dateReceived: string;
  estimateDate: string | null;
  estimateTime: string;
  assignedPerson: string;
  directions: string;
  estimateNotes: string;
  waitingReason: string;
  declineReason: string;
  declineNotes: string;
  convertedClientId: string | null;
  convertedJobId: string | null;
  convertedInvoiceId: string | null;
  aiSummary: string;
  aiSuggestedReply: string;
  aiPriceEstimate: string;
  aiUpsellSuggestions: string;
  internalNotes: string;
  attachments: IntakeAttachment[];
  photos: IntakeAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type IntakeDashboard = Record<IntakeStatus, number>;

export const STATUS_LABELS: Record<IntakeStatus, string> = {
  new: "New Requests",
  needs_response: "Awaiting Response",
  estimate_scheduled: "Scheduled Estimates",
  waiting_on_customer: "Waiting on Customer",
  approved: "Approved",
  declined: "Declined",
};

export const STATUS_SHORT: Record<IntakeStatus, string> = {
  new: "New",
  needs_response: "Needs response",
  estimate_scheduled: "Estimate",
  waiting_on_customer: "Waiting",
  approved: "Approved",
  declined: "Declined",
};
