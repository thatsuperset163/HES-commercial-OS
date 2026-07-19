/** Offered HES services — single source of truth for labels and CRM ids. */

export const OFFERED_SERVICE_IDS = [
  "pressure_washing",
  "window_cleaning",
  "junk_removal",
] as const;

export type OfferedServiceId = (typeof OFFERED_SERVICE_IDS)[number];

export const OFFERED_SERVICES: { id: OfferedServiceId; label: string }[] = [
  { id: "pressure_washing", label: "Pressure Washing" },
  { id: "window_cleaning", label: "Window Cleaning" },
  { id: "junk_removal", label: "Junk Removal" },
];

export const OFFERED_SERVICE_LABELS = OFFERED_SERVICES.map((s) => s.label);

export const OFFERED_SERVICES_LINE = OFFERED_SERVICE_LABELS.join(" | ");
