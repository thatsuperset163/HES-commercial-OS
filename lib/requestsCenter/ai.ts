import type { IntakeRequest } from "./types.ts";

/** Fast heuristic AI assist — no external API required. */

function moneyBand(service: string): { low: number; high: number; label: string } {
  const s = service.toLowerCase();
  if (s.includes("junk") || s.includes("haul") || s.includes("debris")) {
    return { low: 150, high: 900, label: "junk removal" };
  }
  if (s.includes("window") || s.includes("glass")) {
    return { low: 150, high: 650, label: "window cleaning" };
  }
  if (
    s.includes("pressure") ||
    s.includes("wash") ||
    s.includes("commercial") ||
    s.includes("house")
  ) {
    return { low: 250, high: 1200, label: "pressure washing" };
  }
  return { low: 250, high: 850, label: "pressure washing / window cleaning" };
}

export function generateIntakeAi(request: IntakeRequest): Pick<
  IntakeRequest,
  "aiSummary" | "aiSuggestedReply" | "aiPriceEstimate" | "aiUpsellSuggestions"
> {
  const band = moneyBand(request.serviceRequested);
  const who = request.company || request.customerName;
  const where = request.address || "their property";

  const aiSummary = [
    `${who} requested ${request.serviceRequested || "service"} via ${request.requestSource}.`,
    request.priority === "urgent" || request.priority === "high"
      ? `Priority is ${request.priority} — respond same day.`
      : "Standard priority — respond within one business day.",
    request.notes ? `Customer note: ${request.notes}` : "No customer notes yet.",
  ].join(" ");

  const aiSuggestedReply = [
    `Hi ${request.customerName.split(" ")[0] || "there"},`,
    ``,
    `Thanks for reaching out to Harris Exterior Solutions about ${request.serviceRequested || "your project"} at ${where}.`,
    `I can swing by for a quick estimate — does tomorrow or the next day work for you?`,
    ``,
    `— Harris Exterior Solutions`,
  ].join("\n");

  const aiPriceEstimate = `Typical range for ${band.label}: $${band.low}–$${band.high} (confirm on-site).`;

  const aiUpsellSuggestions = [
    "Ask if windows need cleaning while on site",
    "Ask about junk/debris haul-away with the wash",
    "Offer seasonal maintenance plan after first job",
    "Ask for Google review + referral after completion",
  ].join(" · ");

  return { aiSummary, aiSuggestedReply, aiPriceEstimate, aiUpsellSuggestions };
}
