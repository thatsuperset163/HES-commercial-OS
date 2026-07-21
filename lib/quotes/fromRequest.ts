import type { IntakeRequest } from "../requestsCenter/types.ts";
import type { QuoteKind } from "../work/types.ts";
import { SOURCE_LABELS } from "../requestsCenter/types.ts";

/** Build quote compose notes from intake fields — only include what exists. */
export function buildQuoteNotesFromRequest(request: IntakeRequest): string {
  const lines: string[] = [];
  if (request.serviceRequested.trim()) {
    lines.push(`Requested service: ${request.serviceRequested.trim()}`);
  }
  if (request.propertyType) {
    lines.push(`Property type: ${request.propertyType}`);
  }
  if (request.requestSource) {
    lines.push(
      `Source: ${SOURCE_LABELS[request.requestSource] || request.requestSource}`,
    );
  }
  if (request.estimateNotes.trim()) {
    lines.push(`Site / measurements:\n${request.estimateNotes.trim()}`);
  }
  if (request.directions.trim()) {
    lines.push(`Access / directions:\n${request.directions.trim()}`);
  }
  if (request.estimateDate || request.estimateTime) {
    lines.push(
      `Timing: ${[request.estimateDate, request.estimateTime].filter(Boolean).join(" · ")}`,
    );
  }
  if (request.notes.trim()) {
    lines.push(`Customer notes:\n${request.notes.trim()}`);
  }
  if (request.internalNotes.trim()) {
    lines.push(`Internal notes:\n${request.internalNotes.trim()}`);
  }
  if (request.siteVisitOutcome.trim()) {
    lines.push(`Site visit outcome: ${request.siteVisitOutcome.trim()}`);
  }
  const photoRefs = [...request.photos, ...request.attachments]
    .map((a) => a.name || a.url)
    .filter(Boolean);
  if (photoRefs.length) {
    lines.push(`Files / photos: ${photoRefs.join(", ")}`);
  }
  if (request.potentialValue != null && Number.isFinite(request.potentialValue)) {
    lines.push(`Estimated value (request): $${Math.round(request.potentialValue)}`);
  }
  return lines.join("\n\n");
}

export function buildQuoteComposeUrl(input: {
  request: IntakeRequest;
  clientId?: string | null;
  clientName?: string;
  quoteKind?: QuoteKind;
  /** When creating an intentional additional quote while one already exists. */
  forceNew?: boolean;
}): string {
  const { request } = input;
  const params = new URLSearchParams({ new: "1" });
  params.set("requestId", request.id);
  if (input.clientId) params.set("clientId", input.clientId);
  const name =
    (input.clientName || "").trim() ||
    request.company.trim() ||
    request.customerName.trim();
  if (name) params.set("clientName", name);
  if (request.company.trim()) params.set("companyName", request.company.trim());
  if (request.customerName.trim() && request.company.trim()) {
    params.set("contactName", request.customerName.trim());
  }
  if (request.phone.trim()) params.set("phone", request.phone.trim());
  if (request.email.trim()) params.set("email", request.email.trim());
  if (request.address.trim()) {
    params.set("address", request.address.trim());
    params.set("billingAddress", request.address.trim());
  }
  const scope =
    request.serviceRequested.trim() ||
    request.notes.trim() ||
    "Exterior cleaning";
  params.set("scope", scope);
  const notes = buildQuoteNotesFromRequest(request);
  if (notes) params.set("notes", notes);
  if (request.potentialValue != null && Number.isFinite(request.potentialValue)) {
    params.set("amount", String(request.potentialValue));
  }
  if (request.propertyType) params.set("propertyType", request.propertyType);
  params.set("quoteKind", input.quoteKind || "primary");
  if (input.forceNew) params.set("forceNew", "1");
  return `/work/quotes?${params.toString()}`;
}

export function matchReasonLabel(reason: string): string {
  switch (reason) {
    case "email":
      return "Exact email";
    case "phone":
      return "Exact phone";
    case "company_and_address":
      return "Company + address";
    case "name_and_address":
      return "Name + address";
    default:
      return reason;
  }
}
