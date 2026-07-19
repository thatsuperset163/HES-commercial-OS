"use client";

import { useMemo } from "react";
import { getWeekKeys } from "@/lib/dates";
import {
  buildMonthGrid,
  monthLabel,
  weekRangeLabel,
  type ScheduleFilterState,
} from "@/lib/jobs/calendar";
import type { CalendarView, Job } from "@/lib/jobs/types";
import DayView from "./DayView";
import MonthView from "./MonthView";
import WeekView from "./WeekView";

type Props = {
  view: CalendarView;
  anchorKey: string;
  jobs: Job[];
  filters: ScheduleFilterState;
  onSelectJob: (job: Job) => void;
  onOpenDay: (dateKey: string) => void;
  onCreateOnDate: (dateKey: string, startTime?: string) => void;
  onPatchJob: (job: Job, patch: Partial<Job>) => void;
  onEditJob: (job: Job) => void;
  onRescheduleJob: (job: Job) => void;
  onDragReschedule: (
    job: Job,
    scheduledDate: string,
    startTime: string,
  ) => void;
};

export default function JobsCalendar({
  view,
  anchorKey,
  jobs,
  onSelectJob,
  onOpenDay,
  onCreateOnDate,
  onPatchJob,
  onEditJob,
  onRescheduleJob,
  onDragReschedule,
}: Props) {
  const monthCells = useMemo(
    () => buildMonthGrid(anchorKey, jobs),
    [anchorKey, jobs],
  );
  const weekKeys = useMemo(() => getWeekKeys(anchorKey), [anchorKey]);

  if (view === "month") {
    return (
      <section className="jobs-calendar-panel" aria-label={monthLabel(anchorKey)}>
        <MonthView
          cells={monthCells}
          onSelectJob={onSelectJob}
          onOpenDay={onOpenDay}
          onCreateOnDate={(dateKey) => onCreateOnDate(dateKey)}
        />
      </section>
    );
  }

  if (view === "week") {
    return (
      <section
        className="jobs-calendar-panel"
        aria-label={weekRangeLabel(weekKeys)}
      >
        <WeekView
          anchorKey={anchorKey}
          jobs={jobs}
          onSelectJob={onSelectJob}
          onOpenDay={onOpenDay}
          onCreateAt={(dateKey, startTime) => onCreateOnDate(dateKey, startTime)}
          onReschedule={onDragReschedule}
        />
      </section>
    );
  }

  return (
    <section className="jobs-calendar-panel" aria-label="Day view">
      <DayView
        dateKey={anchorKey}
        jobs={jobs}
        onOpenJob={onSelectJob}
        onEditJob={onEditJob}
        onPatchJob={onPatchJob}
        onReschedule={onRescheduleJob}
      />
    </section>
  );
}
