import type { IntakeRequest } from "./types.ts";

/** Fast heuristic AI assist — no external API required. */

function moneyBand(service: string): { low: number; high: number; label: string } {
  const s = service.toLowerCase();
  if (s.includes("commercial") || s.includes("plaza") || s.includes("hoa")) {
    return { low: 450, high: 1800, label: "commercial exterior package" };
  }
  if (s.includes("concrete") || s.includes("drive") || s.includes("sidewalk")) {
    return { low: 175, high: 650, label: "concrete / hardscape clean" };
  }
  if (s.includes("roof") || s.includes("soft wash")) {
    return { low: 350, high: 1200, label: "soft wash" };
  }
  return { low: 250, high: 850, label: "house wash" };
}

export function generateIntakeAi(request: IntakeRequest): Pick<
  IntakeRequest,
  "aiSummary" | "aiSuggestedReply" | "aiPriceEstimate" | "aiUpsellSuggestions"
> {
  const band = moneyBand(request.serviceRequested);
  const who = request.company || request.customerName;
  const where = request.address || "their property";

  const aiSummary = [
    `${who} requested ${request.serviceRequested || "exterior cleaning"} via ${request.requestSource}.`,
    request.priority === "urgent" || request.priority === "high"
      ? `Priority is ${request.priority} — respond same day.`
      : "Standard priority — respond within one business day.",
    request.notes ? `Customer note: ${request.notes}` : "No customer notes yet.",
  ].join(" ");

  const aiSuggestedReply = [
    `Hi ${request.customerName.split(" ")[0] || "there"},`,
    ``,
    `Thanks for reaching out to Harris Exterior Solutions about ${request.serviceRequested || "exterior cleaning"} at ${where}.`,
    `I can swing by for a quick estimate — does tomorrow or the next day work for you?`,
    ``,
    `— Harris Exterior Solutions`,
  ].join("\n");

  const aiPriceEstimate = `Typical range for a ${band.label}: $${band.low}–$${band.high} (confirm on-site).`;

  const aiUpsellSuggestions = [
    "Add concrete/driveway clean while on site",
    "Offer seasonal maintenance plan after first wash",
    "Ask for Google review + referral after completion",
  ].join(" · ");

  return { aiSummary, aiSuggestedReply, aiPriceEstimate, aiUpsellSuggestions };
}
