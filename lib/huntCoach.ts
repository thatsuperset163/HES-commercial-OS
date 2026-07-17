import type { ChecklistItem } from "./types.ts";
import { parseDateKey } from "./dates.ts";

export type HuntAction = {
  id: string;
  label: string;
  /** Where to go to do this — not a vague checklist item. */
  href: string;
  cta: string;
};

export type HuntDayPlan = {
  /** 0 Sun … 6 Sat — matches Date#getDay() */
  weekday: number;
  name: string;
  mission: string;
  why: string;
  actions: HuntAction[];
};

/**
 * Fixed weekly hunt loop for finding exterior-cleaning work.
 * Each step deep-links into a Work desk so you are never guessing where to go.
 */
export const HUNT_WEEK: HuntDayPlan[] = [
  {
    weekday: 1,
    name: "Monday — Warm list",
    mission: "Build or revive your money list, then touch 5 people.",
    why: "Work comes from names you already have before you chase strangers.",
    actions: [
      {
        id: "mon-open-clients",
        label: "Open Clients and add every past customer you remember",
        href: "/work/clients",
        cta: "Go to Clients",
      },
      {
        id: "mon-requests",
        label: "Park any inbound asks in Requests so they do not vanish",
        href: "/work/requests",
        cta: "Go to Requests",
      },
      {
        id: "mon-sales",
        label: "Touch 5 warm names in Sales (call or text)",
        href: "/work/sales/",
        cta: "Open Sales",
      },
      {
        id: "mon-tasks",
        label: "Create follow-up Tasks for anyone who needs a next touch",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
      {
        id: "mon-log",
        label: "Write one note in Personal about who answered",
        href: "/personal",
        cta: "Open Personal",
      },
    ],
  },
  {
    weekday: 2,
    name: "Tuesday — Follow-through",
    mission: "Close open loops. Nobody gets to ghost you silently.",
    why: "Most booked jobs come from the 2nd–4th touch, not the first.",
    actions: [
      {
        id: "tue-tasks",
        label: "Clear due Tasks — do or reschedule each one",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
      {
        id: "tue-requests",
        label: "Work every open Request (contacted → quoted)",
        href: "/work/requests",
        cta: "Go to Requests",
      },
      {
        id: "tue-sales",
        label: "Send 3 real follow-ups in Sales",
        href: "/work/sales/",
        cta: "Open Sales",
      },
      {
        id: "tue-quotes",
        label: "Open Quotes and follow up anything already sent",
        href: "/work/quotes",
        cta: "Go to Quotes",
      },
      {
        id: "tue-jobs",
        label: "If someone said yes, schedule the Job",
        href: "/work/jobs",
        cta: "Go to Jobs",
      },
    ],
  },
  {
    weekday: 3,
    name: "Wednesday — Doors",
    mission: "One residential route. Protect the block.",
    why: "When the phone is quiet, doors create new conversations.",
    actions: [
      {
        id: "wed-task-route",
        label: "Write today’s neighborhood as a Task before you leave",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
      {
        id: "wed-hq",
        label: "After the route, log doors / conversations on HQ",
        href: "/",
        cta: "Open HQ",
      },
      {
        id: "wed-clients",
        label: "Add hot leads as Clients",
        href: "/work/clients",
        cta: "Go to Clients",
      },
      {
        id: "wed-requests",
        label: "Turn interested people into Requests",
        href: "/work/requests",
        cta: "Go to Requests",
      },
      {
        id: "wed-jobs",
        label: "If they want work, schedule an estimate Job same day",
        href: "/work/jobs",
        cta: "Go to Jobs",
      },
    ],
  },
  {
    weekday: 4,
    name: "Thursday — Commercial",
    mission: "Walk a plaza. Talk to managers. Fill the commercial pipe.",
    why: "Commercial repeats. One good account beats ten one-off houses.",
    actions: [
      {
        id: "thu-sales",
        label: "Run commercial outreach in Sales",
        href: "/work/sales/",
        cta: "Open Sales",
      },
      {
        id: "thu-clients",
        label: "Add 5 new commercial Clients from today’s walk",
        href: "/work/clients",
        cta: "Go to Clients",
      },
      {
        id: "thu-requests",
        label: "Log every soft yes as a Request",
        href: "/work/requests",
        cta: "Go to Requests",
      },
      {
        id: "thu-quotes",
        label: "Start a Quote for anyone ready for a number",
        href: "/work/quotes",
        cta: "Go to Quotes",
      },
      {
        id: "thu-tasks",
        label: "Set follow-up Tasks for the rest",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
    ],
  },
  {
    weekday: 5,
    name: "Friday — Turn heat into money",
    mission: "Quotes, decisions, invoices — convert the week’s talks.",
    why: "Outreach without closeout is just busy. Today you collect.",
    actions: [
      {
        id: "fri-quotes",
        label: "Finish or send every open Quote",
        href: "/work/quotes",
        cta: "Go to Quotes",
      },
      {
        id: "fri-quote-follow",
        label: "Follow up sent Quotes waiting on an answer",
        href: "/work/quotes",
        cta: "Open Quotes",
      },
      {
        id: "fri-invoices",
        label: "Create/send Invoices for finished Jobs",
        href: "/work/invoices",
        cta: "Go to Invoices",
      },
      {
        id: "fri-jobs",
        label: "Check Jobs — mark done work so it can be billed",
        href: "/work/jobs",
        cta: "Go to Jobs",
      },
      {
        id: "fri-saturday",
        label: "Write Saturday’s route as a Task",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
    ],
  },
  {
    weekday: 6,
    name: "Saturday — Long hunt block",
    mission: "One protected field block. Finish it. Then stop.",
    why: "A full Saturday push can refill the whole week’s pipeline.",
    actions: [
      {
        id: "sat-task",
        label: "Open today’s hunt Task and protect a 2-hour block",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
      {
        id: "sat-clients",
        label: "Add every new name to Clients before you get home",
        href: "/work/clients",
        cta: "Go to Clients",
      },
      {
        id: "sat-requests",
        label: "Capture soft yeses in Requests",
        href: "/work/requests",
        cta: "Go to Requests",
      },
      {
        id: "sat-sales",
        label: "Mark next week’s top 5 targets in Sales",
        href: "/work/sales/",
        cta: "Open Sales",
      },
      {
        id: "sat-expenses",
        label: "Log fuel/supplies Expenses from the week",
        href: "/work/expenses",
        cta: "Go to Expenses",
      },
    ],
  },
  {
    weekday: 0,
    name: "Sunday — Reset",
    mission: "Clear the noise. Set Monday. Rest on purpose.",
    why: "ADHD weeks die when Sunday is chaos. Keep this light and sharp.",
    actions: [
      {
        id: "sun-hq",
        label: "Review the Work pipeline strip on HQ (15 min)",
        href: "/",
        cta: "Open HQ",
      },
      {
        id: "sun-quotes",
        label: "Scan Quotes / Invoices for anything stuck",
        href: "/work/quotes",
        cta: "Go to Quotes",
      },
      {
        id: "sun-tasks",
        label: "Set Monday’s first Task",
        href: "/work/tasks",
        cta: "Go to Tasks",
      },
      {
        id: "sun-ideas",
        label: "Parking lot cleanup in Personal — keep 1 idea max",
        href: "/personal",
        cta: "Open Personal",
      },
      {
        id: "sun-rest",
        label: "Stop. Faith / people / rest — no building software",
        href: "/personal",
        cta: "Open Personal",
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

export function getHuntActionMeta(
  dateKey: string,
  actionId: string,
): HuntAction | null {
  return (
    getHuntPlanForDate(dateKey).actions.find((action) => action.id === actionId) ??
    null
  );
}
