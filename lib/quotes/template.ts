/** Official HES quote document copy (from HES quote template.docx). */

export const HES_QUOTE_INTRO =
  "Thank you for considering Harris Exterior Solutions for your exterior cleaning needs. Below is your personalized quote. We take pride in delivering quality, safe, and professional services that protect your property’s value and enhance curb appeal.";

export const HES_QUOTE_TERMS: string[] = [
  "Harris Exterior Solutions LLC is fully licensed and insured for all residential and commercial exterior services.",
  "Client must provide access to a functioning outdoor water spigot; Harris Exterior Solutions uses the client’s water supply for all services performed.",
  "Payment is due upon completion unless prior arrangements have been made in writing.",
  "We use high and low-pressure washing methods and professional-grade cleaning solutions designed to safely clean surfaces without causing damage.",
  "While we take every precaution to protect your property, Harris Exterior Solutions LLC is not responsible for pre-existing damage, loose siding, deteriorating paint, or other underlying issues.",
  "In the event of inclement weather or unforeseen circumstances, services may be rescheduled at no additional cost to the client.",
];

export const HES_COMPANY = {
  legalName: "Harris Exterior Solutions LLC",
  brandName: "Harris Exterior Solutions",
  shortName: "HES",
} as const;

export function formatQuoteMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "TBD";
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatQuoteDate(isoOrKey: string): string {
  const key = (isoOrKey || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return isoOrKey || "—";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
