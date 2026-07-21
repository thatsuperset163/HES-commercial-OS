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
  "google",
  "phone",
  "email",
  "referral",
  "repeat",
  "door",
  "social",
  "commercial",
  "property_manager",
  "school",
  "text",
  "manual",
  "other",
] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const SOURCE_LABELS: Record<RequestSource, string> = {
  website: "Website",
  google: "Google",
  phone: "Phone call",
  email: "Email",
  referral: "Referral",
  repeat: "Repeat client",
  door: "Door knocking",
  social: "Social media",
  commercial: "Commercial outreach",
  property_manager: "Property manager",
  school: "School",
  text: "Text",
  manual: "Manual",
  other: "Other",
};

export const PROPERTY_TYPES = ["", "residential", "commercial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FOLLOW_UP_TYPES = [
  "call",
  "email",
  "text",
  "site_visit",
  "quote_reminder",
  "check_in",
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const WAITING_REASONS = [
  "Waiting for approval",
  "Waiting for access",
  "Waiting for HOA",
  "Waiting on insurance",
  "Waiting for photos",
  "Other",
] as const;

export const DECLINE_REASONS = [
  "Price",
  "No response",
  "Chose competitor",
  "Outside service area",
  "Service not offered",
  "Timing",
  "Insurance or compliance",
  "Not profitable",
  "Duplicate request",
  "Spam",
  "Too expensive",
  "Competitor",
  "Not interested",
  "Other",
] as const;

export const SITE_VISIT_OUTCOMES = [
  "Ready to quote",
  "Need more information",
  "Not a fit",
  "Follow up later",
  "Convert directly to job",
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
  convertedQuoteId: string | null;
  linkedClientId: string | null;
  followUpDate: string | null;
  followUpType: string;
  followUpNotes: string;
  potentialValue: number | null;
  propertyType: PropertyType;
  siteVisitOutcome: string;
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

/** User-facing labels — preserve DB status keys for compatibility. */
export const STATUS_LABELS: Record<IntakeStatus, string> = {
  new: "New",
  needs_response: "Needs response",
  estimate_scheduled: "Site visit scheduled",
  waiting_on_customer: "Waiting on client",
  approved: "Converted",
  declined: "Lost",
};

export const STATUS_SHORT: Record<IntakeStatus, string> = {
  new: "New",
  needs_response: "Respond",
  estimate_scheduled: "Visit",
  waiting_on_customer: "Waiting",
  approved: "Converted",
  declined: "Lost",
};

export const STATUS_HELP: Record<IntakeStatus, string> = {
  new: "Fresh inbound — make first contact",
  needs_response: "You owe the client a reply",
  estimate_scheduled: "Site visit is on the calendar",
  waiting_on_customer: "Ball is in the client's court",
  approved: "Converted to client / job",
  declined: "Closed as lost — keep for reporting",
};
