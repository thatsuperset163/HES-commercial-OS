import { parseDateKey, toDateKey } from "../dates.ts";
import type { Job } from "./types.ts";

export type JobNextAction = {
  id: string;
  jobId: string;
  title: string;
  reason: string;
  urgency: "overdue" | "today" | "money" | "soon";
  customerName: string;
  scheduledDate: string;
  amount: number | null;
  status: Job["status"];
};

function daysUntil(dateKey: string, now = new Date()) {
  const due = parseDateKey(dateKey);
  const today = parseDateKey(toDateKey(now));
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/** Ranked next moves across Jobs — peer to Sales "Do this next". */
export function buildJobNextActions(jobs: Job[], now = new Date()): JobNextAction[] {
  const open = jobs.filter((job) => job.status !== "cancelled");
  const actions: JobNextAction[] = [];

  for (const job of open) {
    if (job.status === "done") {
      actions.push({
        id: `invoice-${job.id}`,
        jobId: job.id,
        title: `Invoice ${job.customerName}`,
        reason: "Job is done — bill it so cash moves",
        urgency: "money",
        customerName: job.customerName,
        scheduledDate: job.scheduledDate,
        amount: job.amount,
        status: job.status,
      });
      continue;
    }

    if (job.status === "scheduled") {
      const delta = daysUntil(job.scheduledDate, now);
      if (delta < 0) {
        actions.push({
          id: `overdue-${job.id}`,
          jobId: job.id,
          title: `Finish or reschedule ${job.customerName}`,
          reason: "Scheduled date already passed",
          urgency: "overdue",
          customerName: job.customerName,
          scheduledDate: job.scheduledDate,
          amount: job.amount,
          status: job.status,
        });
      } else if (delta === 0) {
        actions.push({
          id: `today-${job.id}`,
          jobId: job.id,
          title: `Run job — ${job.customerName}`,
          reason: job.address ? job.address : "On the schedule for today",
          urgency: "today",
          customerName: job.customerName,
          scheduledDate: job.scheduledDate,
          amount: job.amount,
          status: job.status,
        });
      } else if (delta <= 2) {
        actions.push({
          id: `soon-${job.id}`,
          jobId: job.id,
          title: `Prep for ${job.customerName}`,
          reason: `On the schedule in ${delta} day${delta === 1 ? "" : "s"}`,
          urgency: "soon",
          customerName: job.customerName,
          scheduledDate: job.scheduledDate,
          amount: job.amount,
          status: job.status,
        });
      }
    }
  }

  const rank = { overdue: 0, money: 1, today: 2, soon: 3 } as const;
  return actions.sort((a, b) => {
    const byUrgency = rank[a.urgency] - rank[b.urgency];
    if (byUrgency !== 0) return byUrgency;
    const byMoney = (b.amount || 0) - (a.amount || 0);
    if (byMoney !== 0) return byMoney;
    return a.scheduledDate.localeCompare(b.scheduledDate);
  });
}
