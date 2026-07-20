import { todayKey } from "../dates.ts";
import type { ClientRelated, ClientSummary } from "./related.ts";

export type ClientNextAction = {
  title: string;
  reason: string;
  href: string;
  urgency: "overdue" | "today" | "money" | "soon" | "clear";
};

/** Surface the single most useful next move for this client. */
export function buildClientNextAction(
  related: ClientRelated,
  summary: ClientSummary,
  today = todayKey(),
): ClientNextAction {
  const overdueInv = related.invoices.find(
    (i) => i.status === "overdue" || (i.status === "sent" && i.dueDate < today),
  );
  if (overdueInv) {
    return {
      title: "Collect unpaid invoice",
      reason: overdueInv.jobLabel || "Past due balance",
      href: "/work/invoices",
      urgency: "overdue",
    };
  }

  const draftInv = related.invoices.find((i) => i.status === "draft");
  if (draftInv) {
    return {
      title: "Send invoice",
      reason: draftInv.jobLabel || "Draft ready to send",
      href: "/work/invoices",
      urgency: "money",
    };
  }

  const billable = related.jobs.find(
    (j) =>
      j.status === "completed" &&
      j.invoiceStatus !== "sent" &&
      j.invoiceStatus !== "paid",
  );
  if (billable) {
    return {
      title: "Invoice completed work",
      reason: billable.service || billable.title || "Job finished",
      href: "/work/invoices",
      urgency: "money",
    };
  }

  const quoteFollow = related.quotes.find(
    (q) => q.status === "sent" && q.followUpDate <= today,
  );
  if (quoteFollow) {
    return {
      title: "Follow up on quote",
      reason: quoteFollow.scope || "Sent quote waiting",
      href: "/work/quotes",
      urgency: quoteFollow.followUpDate < today ? "overdue" : "today",
    };
  }

  const draftQuote = related.quotes.find((q) => q.status === "draft");
  if (draftQuote) {
    return {
      title: "Finish quote",
      reason: draftQuote.scope || "Draft quote",
      href: "/work/quotes",
      urgency: "soon",
    };
  }

  const newReq = related.requests.find((r) => r.status === "new");
  if (newReq) {
    return {
      title: "Respond to request",
      reason: newReq.summary || "New request",
      href: "/work/requests",
      urgency: "today",
    };
  }

  if (summary.nextActivity) {
    return {
      title: "Upcoming work",
      reason: summary.nextActivity,
      href: "/work/jobs",
      urgency: "soon",
    };
  }

  return {
    title: "No action needed",
    reason: "This client is clear for now.",
    href: "/work/clients",
    urgency: "clear",
  };
}
