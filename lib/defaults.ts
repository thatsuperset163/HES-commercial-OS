import type {
  ChecklistItem,
  DayEntry,
  GoalItem,
  OutreachTarget,
} from "./types";
import { EMPTY_METRICS } from "./types";

function items(
  rows: { id: string; label: string }[]
): Omit<ChecklistItem, "done">[] {
  return rows;
}

/** Every-day essentials — always on the daily checklist */
export const DAILY_ESSENTIALS = items([
  { id: "wake-hydrate", label: "Wake up & hydrate" },
  { id: "move-body", label: "Exercise / move (walk, lift, or stretch)" },
  { id: "golf-touch", label: "Golf — play, practice, or touch the clubs" },
  { id: "eat-solid", label: "Eat real meals (no skipping)" },
  { id: "clean-space", label: "Quick tidy / reset living space" },
  { id: "no-screens", label: "No screens before bed / wind down" },
]);

/** Rotating life extras — 2 picked per day (no hobby block) */
export const DAILY_ROTATING_POOL = items([
  { id: "call-love", label: "Call / text someone you love" },
  { id: "encourage-buddy", label: "Send an encouraging message to a buddy" },
  { id: "learn-one", label: "Learn one thing (15 min — book, podcast, video)" },
  { id: "plan-fun", label: "Plan one fun thing this week" },
  { id: "outside-10", label: "Go outside with no agenda for 10 minutes" },
  { id: "journal-wins", label: "Journal 3 wins from today" },
  { id: "cook-real", label: "Cook a real meal instead of grabbing junk" },
  { id: "mobility", label: "Mobility / stretch-focused session" },
  { id: "quiet-time", label: "Faith, gratitude, or quiet time" },
  { id: "customer-friend", label: "Check in on a customer who’s become a friend" },
  { id: "family-favor", label: "Do one unpaid favor for family" },
  { id: "phone-away", label: "Put the phone in another room for one hour" },
  { id: "sunset", label: "Watch a sunset / sit still outside" },
]);

/** Morning essentials — always on the morning work checklist */
export const MORNING_ESSENTIALS = items([
  { id: "email-voicemail", label: "Check email & voicemail" },
  { id: "leads", label: "Review leads (forms, Google, Facebook)" },
  { id: "schedule", label: "Confirm today's jobs / route" },
  { id: "weather", label: "Check weather for wash days" },
  { id: "outreach-plan", label: "Review today's commercial outreach list" },
]);

/** Morning extras — 2 picked per day */
export const MORNING_ROTATING_POOL = items([
  { id: "followups", label: "Send quote follow-ups" },
  { id: "gbp", label: "Update Google Business / social" },
  { id: "invoices", label: "Send invoices / check payments" },
  { id: "polish-quote", label: "Draft or polish one commercial proposal" },
  { id: "research-targets", label: "Research 3 new commercial targets" },
  { id: "supply-check", label: "Check supplies / consumables / reorder needs" },
  { id: "pipeline-notes", label: "Review pipeline / CRM notes" },
  { id: "content-photo", label: "Prep before/after photos for content" },
  { id: "overnight-calls", label: "Personally return overnight callbacks" },
  { id: "estimate-block", label: "Block time for estimates later today" },
  { id: "local-seo", label: "Check local SEO / competitor ads for 10 min" },
  { id: "route-map", label: "Map this afternoon's door / commercial route" },
]);

/** Afternoon work block — field / doors / closeout */
export const AFTERNOON_WORK_DEFAULTS = items([
  { id: "gear-ready", label: "Gear / truck ready to roll" },
  { id: "door-route", label: "Door knocking route (hit the neighborhoods)" },
  { id: "commercial-hits", label: "Commercial drop-bys / cold outreach" },
  { id: "callbacks", label: "Return afternoon calls / texts" },
  { id: "log-numbers", label: "Log doors, conversations, phones, quotes, jobs" },
  { id: "pack-clean", label: "Pack up / rinse gear" },
  { id: "tomorrow-plan", label: "Note tomorrow's top 3" },
]);

/** Full pool — 5 picked per day via seeded shuffle */
export const OUTREACH_POOL = items([
  { id: "apt-managers", label: "Call / visit 2 apartment property managers" },
  { id: "hoa-boards", label: "Reach out to an HOA / townhome management co." },
  { id: "church-daycare", label: "Drop by a church or daycare facilities contact" },
  { id: "retail-plaza", label: "Hit a retail plaza (storefronts + dumpster pads)" },
  { id: "gas-fleet", label: "Pitch gas station canopy or fleet wash" },
  { id: "storage-units", label: "Contact a self-storage or warehouse site" },
  { id: "restaurant-grease", label: "Offer sidewalk / grease-area wash to a restaurant" },
  { id: "school-office", label: "Touch base with a school or office park FM" },
  { id: "auto-dealer", label: "Pitch lot wash to a car dealership or body shop" },
  { id: "bank-branch", label: "Drop a card at a bank or credit union branch" },
  { id: "gym-rec", label: "Approach a gym, rec center, or community club" },
  { id: "past-lead", label: "Follow up one old commercial lead / quote" },
  { id: "ask-review", label: "Ask a happy customer for a Google review" },
  { id: "plaza-walk", label: "Walk one commercial plaza and open 3 conversations" },
  { id: "linkedin-email", label: "Send 3 commercial outreach emails / DMs" },
  { id: "partner-trade", label: "Touch base with a trade partner (roofer, painter, landscaper)" },
  { id: "construction-site", label: "Check a job site / new build for post-construction wash" },
  { id: "hoa-board-packet", label: "Prepare / send one HOA proposal packet" },
]);

const DAILY_OUTREACH_COUNT = 5;
const DAILY_ROTATING_COUNT = 2;
const MORNING_ROTATING_COUNT = 2;

function withDone(
  rows: Omit<ChecklistItem, "done">[]
): ChecklistItem[] {
  return rows.map((item) => ({ ...item, done: false }));
}

function hashDateKey(dateKey: string, salt = ""): number {
  const input = `${salt}:${dateKey}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickSeeded(
  pool: Omit<ChecklistItem, "done">[],
  dateKey: string,
  count: number,
  salt: string
): ChecklistItem[] {
  const copy = [...pool];
  let seed = hashDateKey(dateKey, salt);
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return withDone(copy.slice(0, count));
}

/** Deterministic shuffle so the same date always gets the same 5. */
export function pickDailyOutreach(dateKey: string): ChecklistItem[] {
  return pickSeeded(OUTREACH_POOL, dateKey, DAILY_OUTREACH_COUNT, "outreach");
}

/** 2 rotating life items for the day (stable per date). */
export function pickDailyLifeExtras(dateKey: string): ChecklistItem[] {
  return pickSeeded(
    DAILY_ROTATING_POOL,
    dateKey,
    DAILY_ROTATING_COUNT,
    "life"
  );
}

export function buildDailyChecklist(dateKey: string): ChecklistItem[] {
  return [...withDone(DAILY_ESSENTIALS), ...pickDailyLifeExtras(dateKey)];
}

export function pickMorningExtras(dateKey: string): ChecklistItem[] {
  return pickSeeded(
    MORNING_ROTATING_POOL,
    dateKey,
    MORNING_ROTATING_COUNT,
    "morning"
  );
}

export function buildMorningWorkChecklist(dateKey: string): ChecklistItem[] {
  return [...withDone(MORNING_ESSENTIALS), ...pickMorningExtras(dateKey)];
}

/** Personal goals — faith + putting yourself out there (varies daily) */
export const PERSONAL_GOAL_POOL = [
  {
    id: "p-pray",
    text: "Pray or sit in quiet with God for 10 focused minutes",
  },
  {
    id: "p-scripture",
    text: "Read a short stretch of Scripture and write one takeaway",
  },
  {
    id: "p-gratitude",
    text: "Write 3 specific things you’re grateful to God for today",
  },
  {
    id: "p-worship",
    text: "Play worship / a sermon on the drive and actually listen",
  },
  {
    id: "p-encourage",
    text: "Send one sincere word of encouragement to someone",
  },
  {
    id: "p-serve",
    text: "Do one quiet act of service with no credit attached",
  },
  {
    id: "p-church-plan",
    text: "Confirm church / group plans — or invite someone to come with you",
  },
  {
    id: "p-eye-contact",
    text: "Make warm eye contact and smile at 5 people today",
  },
  {
    id: "p-new-convo",
    text: "Start one new conversation with someone you don’t usually talk to",
  },
  {
    id: "p-compliment",
    text: "Give one genuine compliment to a girl (not creepy — just kind)",
  },
  {
    id: "p-ask-question",
    text: "Ask a girl a real question about her day / interests and listen",
  },
  {
    id: "p-social-spot",
    text: "Put yourself somewhere social for 30+ minutes (gym, store, event, hang)",
  },
  {
    id: "p-invite",
    text: "Invite someone (girl or friend) to coffee, food, or a simple hang",
  },
  {
    id: "p-intro",
    text: "Practice your 30-second intro once out loud, then use it if the moment hits",
  },
  {
    id: "p-uncomfortable",
    text: "Do one slightly uncomfortable social rep on purpose",
  },
  {
    id: "p-follow-up",
    text: "Follow up with someone you already started talking to",
  },
];

/** Business goals — HES grind (varies daily) */
export const BUSINESS_GOAL_POOL = [
  {
    id: "b-doors",
    text: "Hit a strong door-knocking block — protect the time, no half-effort",
  },
  {
    id: "b-commercial",
    text: "Complete today’s commercial outreach list for real, not halfway",
  },
  {
    id: "b-quotes",
    text: "Send or polish at least one quote / proposal before noon",
  },
  {
    id: "b-followups",
    text: "Clear outstanding quote follow-ups — every open loop gets a touch",
  },
  {
    id: "b-phones",
    text: "Collect more phone numbers than yesterday’s pace (or beat your weekly avg)",
  },
  {
    id: "b-reviews",
    text: "Ask one happy customer for a Google review or referral",
  },
  {
    id: "b-leads",
    text: "Work every new lead same-day — no lead sleeps untouched",
  },
  {
    id: "b-route",
    text: "Map and run one tight neighborhood or commercial corridor",
  },
  {
    id: "b-booked",
    text: "Push for one clear next step: site visit, quote acceptance, or job booked",
  },
  {
    id: "b-content",
    text: "Capture or post one piece of proof (before/after, job shot, win)",
  },
  {
    id: "b-money",
    text: "Send invoices / chase one outstanding payment",
  },
  {
    id: "b-pipeline",
    text: "Review the pipeline and revive one cold commercial lead",
  },
];

function pickOneFromPool(
  pool: { id: string; text: string }[],
  dateKey: string,
  salt: string
): { id: string; text: string } {
  const [item] = pickSeeded(
    pool.map((p) => ({ id: p.id, label: p.text })),
    dateKey,
    1,
    salt
  );
  return { id: item.id, text: item.label };
}

export function pickDailyGoals(dateKey: string): GoalItem[] {
  const personal = pickOneFromPool(PERSONAL_GOAL_POOL, dateKey, "goal-personal");
  const business = pickOneFromPool(BUSINESS_GOAL_POOL, dateKey, "goal-business");
  return [
    {
      id: `personal-${personal.id}`,
      text: personal.text,
      done: false,
      category: "personal",
    },
    {
      id: `business-${business.id}`,
      text: business.text,
      done: false,
      category: "business",
    },
  ];
}

function needsGoalsRebuild(goals: GoalItem[] | undefined): boolean {
  if (!goals || goals.length !== 2) return true;
  const [a, b] = goals;
  if (a.category !== "personal" || b.category !== "business") return true;
  if (!a.text.trim() || !b.text.trim()) return true;
  return false;
}

function normalizeGoals(
  date: string,
  goals: GoalItem[] | undefined
): GoalItem[] {
  if (!needsGoalsRebuild(goals)) return goals as GoalItem[];
  const built = pickDailyGoals(date);
  if (!goals?.length) return built;
  // Preserve done flags when same goal id returns on this date after migration
  return built.map((g) => {
    const prev = goals.find((x) => x.id === g.id);
    return prev ? { ...g, done: prev.done } : g;
  });
}

function isLegacyOutreach(
  outreach: ChecklistItem[] | OutreachTarget[] | undefined
): boolean {
  if (!outreach?.length) return true;
  return outreach.some(
    (item) => item && typeof item === "object" && "name" in item
  );
}

function normalizeOutreach(
  date: string,
  outreach: ChecklistItem[] | OutreachTarget[] | undefined
): ChecklistItem[] {
  if (isLegacyOutreach(outreach)) {
    return pickDailyOutreach(date);
  }
  return outreach as ChecklistItem[];
}

/** Old static daily list lacked golf/no-screens essentials. */
function needsDailyRebuild(list: ChecklistItem[] | undefined): boolean {
  if (!list?.length) return true;
  const ids = new Set(list.map((i) => i.id));
  return !ids.has("golf-touch") || !ids.has("no-screens");
}

function normalizeDailyChecklist(
  date: string,
  list: ChecklistItem[] | undefined
): ChecklistItem[] {
  if (!needsDailyRebuild(list)) return list as ChecklistItem[];
  const built = buildDailyChecklist(date);
  const customs = (list ?? []).filter((i) =>
    i.id.startsWith("dailyChecklist-")
  );
  return [...built, ...customs];
}

/** Old static morning list had followups/gbp/invoices as fixed items. */
export function needsMorningRebuild(list: ChecklistItem[] | undefined): boolean {
  if (!list?.length) return true;
  const ids = new Set(list.map((i) => i.id));
  for (const item of MORNING_ESSENTIALS) {
    if (!ids.has(item.id)) return true;
  }
  // Old 8-item static list always included these three together; new days only get 2 rotating picks
  if (ids.has("followups") && ids.has("gbp") && ids.has("invoices")) {
    return true;
  }
  const rotatingIds = new Set(MORNING_ROTATING_POOL.map((i) => i.id));
  const rotatingPresent = list.filter((i) => rotatingIds.has(i.id)).length;
  if (
    rotatingPresent === 0 &&
    !list.some((i) => i.id.startsWith("morningWorkChecklist-"))
  ) {
    return true;
  }
  return false;
}

function normalizeMorningWorkChecklist(
  date: string,
  list: ChecklistItem[] | undefined,
  legacyMorning?: ChecklistItem[]
): ChecklistItem[] {
  const source = list?.length ? list : legacyMorning;
  if (!needsMorningRebuild(source)) return source as ChecklistItem[];
  const built = buildMorningWorkChecklist(date);
  const customs = (source ?? []).filter((i) =>
    i.id.startsWith("morningWorkChecklist-")
  );
  return [...built, ...customs];
}

export function createDayEntry(date: string): DayEntry {
  return {
    date,
    dailyChecklist: buildDailyChecklist(date),
    morningWorkChecklist: buildMorningWorkChecklist(date),
    afternoonWorkChecklist: withDone(AFTERNOON_WORK_DEFAULTS),
    outreach: pickDailyOutreach(date),
    goals: pickDailyGoals(date),
    metrics: { ...EMPTY_METRICS },
    notes: "",
    personalNotes: "",
    updatedAt: new Date().toISOString(),
  };
}

/** Fill missing checklist fields for older saved days. */
export function normalizeDayEntry(entry: DayEntry): DayEntry {
  const fresh = createDayEntry(entry.date);
  const legacy = entry as DayEntry & {
    coachBrief?: unknown;
    coachConstraint?: unknown;
  };
  const { coachBrief: _brief, coachConstraint: _constraint, ...rest } = legacy;

  return {
    ...fresh,
    ...rest,
    dailyChecklist: normalizeDailyChecklist(entry.date, entry.dailyChecklist),
    morningWorkChecklist: normalizeMorningWorkChecklist(
      entry.date,
      entry.morningWorkChecklist,
      entry.morningChecklist
    ),
    afternoonWorkChecklist: entry.afternoonWorkChecklist?.length
      ? entry.afternoonWorkChecklist
      : fresh.afternoonWorkChecklist,
    outreach: normalizeOutreach(entry.date, entry.outreach),
    goals: normalizeGoals(entry.date, entry.goals),
    metrics: { ...EMPTY_METRICS, ...entry.metrics },
    notes: entry.notes ?? "",
    personalNotes: entry.personalNotes ?? "",
  };
}
