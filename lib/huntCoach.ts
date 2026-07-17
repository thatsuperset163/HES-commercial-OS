import type { ChecklistItem } from "./types.ts";
import { parseDateKey } from "./dates.ts";

export type HuntDayPlan = {
  /** 0 Sun … 6 Sat — matches Date#getDay() */
  weekday: number;
  name: string;
  mission: string;
  why: string;
  actions: { id: string; label: string }[];
  salesHref: string;
};

/**
 * Fixed weekly hunt loop for finding exterior-cleaning work.
 * Same day of week = same mission, so ADHD brains know the script.
 */
export const HUNT_WEEK: HuntDayPlan[] = [
  {
    weekday: 1,
    name: "Monday — Warm list",
    mission: "Build or revive your money list, then touch 5 people.",
    why: "Work comes from names you already have before you chase strangers.",
    salesHref: "/work/sales/",
    actions: [
      { id: "mon-open-sales", label: "Open Sales OS" },
      {
        id: "mon-dump-names",
        label: "Add every past customer + maybe-later lead you remember (aim 10+)",
      },
      { id: "mon-pick-five", label: "Pick your top 5 warmest names" },
      { id: "mon-touch-five", label: "Call or text all 5 — no skipping" },
      {
        id: "mon-log",
        label: "Log result + next step on each prospect in Sales",
      },
    ],
  },
  {
    weekday: 2,
    name: "Tuesday — Follow-through",
    mission: "Close open loops. Nobody gets to ghost you silently.",
    why: "Most booked jobs come from the 2nd–4th touch, not the first.",
    salesHref: "/work/sales/",
    actions: [
      {
        id: "tue-scan",
        label: "Open Sales — find every prospect with no clear next step",
      },
      {
        id: "tue-three",
        label: "Send 3 real follow-ups (call, text, or email)",
      },
      {
        id: "tue-book",
        label: "Push for 1 estimate, site visit, or clear yes/no",
      },
      {
        id: "tue-voicemail",
        label: "If no answer: voicemail + short text, then log it",
      },
      { id: "tue-done-log", label: "Update Sales so tomorrow knows what happened" },
    ],
  },
  {
    weekday: 3,
    name: "Wednesday — Doors",
    mission: "One residential route. Protect the block.",
    why: "When the phone is quiet, doors create new conversations.",
    salesHref: "/work/sales/",
    actions: [
      {
        id: "wed-pick",
        label: "Write down ONE neighborhood before you leave",
      },
      {
        id: "wed-block",
        label: "Knock 30 doors OR work 90 minutes — phone stays in the truck",
      },
      {
        id: "wed-log-counts",
        label: "Note doors / conversations / phone numbers you got",
      },
      {
        id: "wed-sales",
        label: "Add any hot leads to Sales before the day ends",
      },
      {
        id: "wed-estimate",
        label: "If someone wants work, schedule the estimate same day",
      },
    ],
  },
  {
    weekday: 4,
    name: "Thursday — Commercial",
    mission: "Walk a plaza. Talk to managers. Fill the commercial pipe.",
    why: "Commercial repeats. One good account beats ten one-off houses.",
    salesHref: "/work/sales/",
    actions: [
      { id: "thu-corridor", label: "Pick ONE plaza or commercial corridor" },
      {
        id: "thu-eight",
        label: "Walk into 8 businesses and ask for the decision-maker",
      },
      {
        id: "thu-pitch",
        label: "Leave your card + one clear offer (sidewalks, storefronts, lots)",
      },
      {
        id: "thu-five-new",
        label: "Add 5 new commercial prospects to Sales with a next step",
      },
      {
        id: "thu-old",
        label: "Follow up 1 old commercial lead from your list",
      },
    ],
  },
  {
    weekday: 5,
    name: "Friday — Turn heat into money",
    mission: "Quotes, decisions, referrals — convert the week’s talks.",
    why: "Outreach without closeout is just busy. Today you collect.",
    salesHref: "/work/sales/",
    actions: [
      { id: "fri-quotes", label: "Send or polish every open quote" },
      {
        id: "fri-decide",
        label: "Call every estimate that has not given a clear answer",
      },
      {
        id: "fri-referral",
        label: "Ask 1 past customer for a referral or Google review",
      },
      {
        id: "fri-proof",
        label: "Send or post 1 before/after if you have proof (optional but strong)",
      },
      {
        id: "fri-saturday",
        label: "Write Saturday’s route or target list before you stop",
      },
    ],
  },
  {
    weekday: 6,
    name: "Saturday — Long hunt block",
    mission: "One protected field block. Finish it. Then stop.",
    why: "A full Saturday push can refill the whole week’s pipeline.",
    salesHref: "/work/sales/",
    actions: [
      {
        id: "sat-choose",
        label: "Choose doors OR commercial — not both, not ‘see how I feel’",
      },
      {
        id: "sat-block",
        label: "Work a 2-hour hunt block with no app-building and no scrolling",
      },
      {
        id: "sat-follow",
        label: "Hit 5 follow-ups from earlier in the week",
      },
      {
        id: "sat-sales",
        label: "Add every new name to Sales before you get home",
      },
      {
        id: "sat-week",
        label: "Mark next week’s top 5 targets in Sales",
      },
    ],
  },
  {
    weekday: 0,
    name: "Sunday — Reset",
    mission: "Clear the noise. Set Monday. Rest on purpose.",
    why: "ADHD weeks die when Sunday is chaos. Keep this light and sharp.",
    salesHref: "/work/sales/",
    actions: [
      {
        id: "sun-pipeline",
        label: "Review Sales pipeline for 15 minutes — no rebuilding the app",
      },
      {
        id: "sun-list",
        label: "Write Mon–Sat target list (names or places)",
      },
      {
        id: "sun-monday",
        label: "Set Monday’s first call or first stop",
      },
      {
        id: "sun-ideas",
        label: "Parking lot cleanup: keep 1 idea max, leave the rest parked",
      },
      {
        id: "sun-rest",
        label: "Rest / faith / people — you are offline from hustle after this",
      },
    ],
  },
];

export function getHuntPlanForDate(dateKey: string): HuntDayPlan {
  const weekday = parseDateKey(dateKey).getDay();
  return HUNT_WEEK.find((day) => day.weekday === weekday) ?? HUNT_WEEK[0];
}

export function buildHuntChecklist(dateKey: string): ChecklistItem[] {
  return getHuntPlanForDate(dateKey).actions.map((action) => ({
    id: action.id,
    label: action.label,
    done: false,
  }));
}

export function normalizeHuntChecklist(
  dateKey: string,
  list: ChecklistItem[] | undefined,
): ChecklistItem[] {
  const built = buildHuntChecklist(dateKey);
  if (!list?.length) return built;
  const byId = new Map(list.map((item) => [item.id, item]));
  const ids = new Set(built.map((item) => item.id));
  const sameDay = list.length === built.length && list.every((item) => ids.has(item.id));
  if (!sameDay) {
    // Weekday script changed or old day — preserve done only where ids match.
    return built.map((item) => ({
      ...item,
      done: Boolean(byId.get(item.id)?.done),
    }));
  }
  return built.map((item) => ({
    ...item,
    done: Boolean(byId.get(item.id)?.done),
  }));
}

export function getNextHuntAction(
  checklist: ChecklistItem[],
): ChecklistItem | null {
  return checklist.find((item) => !item.done) ?? null;
}
