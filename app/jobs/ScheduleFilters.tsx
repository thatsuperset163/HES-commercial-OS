"use client";

import type { ScheduleFilterState } from "@/lib/jobs/calendar";
import { JOB_STATUSES, type JobStatus } from "@/lib/jobs/types";

type Props = {
  open: boolean;
  filters: ScheduleFilterState;
  onChange: (next: ScheduleFilterState) => void;
  onClose: () => void;
};

export default function ScheduleFilters({
  open,
  filters,
  onChange,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="jobs-filters" role="dialog" aria-label="Schedule filters">
      <div className="jobs-filters-head">
        <strong>Filters</strong>
        <button type="button" className="btn ghost small" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="jobs-field">
        <span>Search</span>
        <input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Customer, service, address…"
        />
      </label>
      <label className="jobs-field">
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as JobStatus | "all",
            })
          }
        >
          <option value="all">All statuses</option>
          {JOB_STATUSES.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label}
            </option>
          ))}
        </select>
      </label>
      <label className="jobs-field">
        <span>Assignee / crew</span>
        <input
          value={filters.assignee}
          onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
          placeholder="Name or crew"
        />
      </label>
      <label className="jobs-check">
        <input
          type="checkbox"
          checked={filters.includeUnscheduled}
          onChange={(e) =>
            onChange({ ...filters, includeUnscheduled: e.target.checked })
          }
        />
        <span>Include unscheduled</span>
      </label>
    </div>
  );
}
