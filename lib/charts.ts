import type { BoardStore, DayEntry } from "./types";
import { normalizeDayEntry } from "./defaults";
import { addDays, parseDateKey, todayKey } from "./dates";

export type DayChartPoint = {
  date: string;
  label: string;
  workPct: number;
  doors: number;
  conversations: number;
  phoneNumbers: number;
  quotes: number;
  jobsBooked: number;
  activityScore: number;
};

function listPct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function dayPercents(entry: DayEntry | undefined) {
  if (!entry) {
    return {
      workPct: 0,
      doors: 0,
      conversations: 0,
      phoneNumbers: 0,
      quotes: 0,
      jobsBooked: 0,
      activityScore: 0,
    };
  }
  const day = normalizeDayEntry(entry);
  const workBoxes = [
    ...day.morningWorkChecklist,
    ...day.afternoonWorkChecklist,
    ...day.outreach,
    ...day.huntChecklist ?? [],
    ...day.goals.filter((g) => g.category === "business"),
  ];
  const m = day.metrics;
  return {
    workPct: listPct(workBoxes.filter((i) => i.done).length, workBoxes.length),
    doors: m.doors || 0,
    conversations: m.conversations || 0,
    phoneNumbers: m.phoneNumbers || 0,
    quotes: m.quotes || 0,
    jobsBooked: m.jobsBooked || 0,
    activityScore:
      (m.doors || 0) +
      (m.conversations || 0) +
      (m.phoneNumbers || 0) +
      (m.quotes || 0) +
      (m.jobsBooked || 0),
  };
}

/** Last N days ending today (oldest → newest). */
export function getLastNDayCharts(
  store: BoardStore,
  n = 7,
  endKey: string = todayKey()
): DayChartPoint[] {
  const points: DayChartPoint[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = addDays(endKey, -i);
    const raw = store.days[date];
    const stats = dayPercents(raw);
    points.push({
      date,
      label: parseDateKey(date).toLocaleDateString(undefined, {
        weekday: "short",
      }),
      ...stats,
    });
  }
  return points;
}
