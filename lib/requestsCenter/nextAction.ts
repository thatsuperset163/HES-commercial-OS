import { todayKey } from "../dates.ts";
import type { IntakeRequest, IntakeStatus } from "./types.ts";

export type RequestNextAction = {
  title: string;
  reason: string;
  urgency: "overdue" | "today" | "soon" | "waiting" | "done" | "lost";
  suggestedStatus?: IntakeStatus;
};

/** One clear next move for an active request. */
export function buildRequestNextAction(
  request: IntakeRequest,
  today = todayKey(),
): RequestNextAction {
  if (request.status === "declined") {
    return {
      title: "Closed as lost",
      reason: request.declineReason || "No further action",
      urgency: "lost",
    };
  }
  if (request.status === "approved" || request.convertedJobId) {
    return {
      title: "Converted — manage in Jobs",
      reason: request.convertedJobId
        ? `Job ${request.convertedJobId}`
        : "Approved request",
      urgency: "done",
    };
  }

  if (request.convertedQuoteId && !request.convertedJobId) {
    if (request.waitingReason.includes("ready for job")) {
      return {
        title: "Create job from approved quote",
        reason: `Quote ${request.convertedQuoteId}`,
        urgency: "today",
      };
    }
    if (request.status === "waiting_on_customer") {
      return {
        title: "Follow up on sent quote",
        reason: request.followUpDate
          ? `Quote follow-up ${request.followUpDate}`
          : `Quote ${request.convertedQuoteId}`,
        urgency:
          request.followUpDate && request.followUpDate < today
            ? "overdue"
            : request.followUpDate === today
              ? "today"
              : "soon",
      };
    }
    return {
      title: "Finish and send quote",
      reason: `Quote draft ${request.convertedQuoteId}`,
      urgency: "soon",
    };
  }

  if (request.followUpDate && request.followUpDate < today) {
    return {
      title: "Overdue follow-up",
      reason: `Due ${request.followUpDate}${request.followUpType ? ` · ${request.followUpType}` : ""}`,
      urgency: "overdue",
    };
  }
  if (request.followUpDate && request.followUpDate === today) {
    return {
      title: "Follow up today",
      reason: request.followUpType || "Check in with client",
      urgency: "today",
    };
  }

  switch (request.status) {
    case "new":
      return {
        title: "Respond to new request",
        reason: "First contact not logged yet",
        urgency: "today",
        suggestedStatus: "needs_response",
      };
    case "needs_response":
      return {
        title: "Call or email the client",
        reason: "Waiting on your response",
        urgency: "soon",
      };
    case "estimate_scheduled":
      return {
        title: request.estimateDate
          ? `Complete site visit ${request.estimateDate}`
          : "Confirm site visit details",
        reason: request.assignedPerson
          ? `Assigned: ${request.assignedPerson}`
          : "Visit on the calendar",
        urgency:
          request.estimateDate && request.estimateDate < today
            ? "overdue"
            : request.estimateDate === today
              ? "today"
              : "soon",
      };
    case "waiting_on_customer":
      return {
        title: "Wait for client — then follow up",
        reason: request.waitingReason || "Ball is in their court",
        urgency: "waiting",
      };
    default:
      return {
        title: "Review request",
        reason: "Pick the next best step",
        urgency: "soon",
      };
  }
}
