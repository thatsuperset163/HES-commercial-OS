/** Personal daily pillars — fixed every day, no fluff, no business. */
export const PERSONAL_PILLARS = [
  { id: "train", label: "Train — lift, run, or hard walk" },
  { id: "golf", label: "Golf — play, practice, or train" },
  { id: "no-porn", label: "No porn" },
  { id: "no-weed", label: "No weed" },
  { id: "faith", label: "Faith — prayer, Scripture, or quiet with God" },
  { id: "people", label: "People — one real reach-out" },
] as const;

export const PERSONAL_PILLAR_IDS = PERSONAL_PILLARS.map((item) => item.id);

export type PersonalPillarId = (typeof PERSONAL_PILLARS)[number]["id"];
