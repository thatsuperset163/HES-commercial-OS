import { formatDate, formatDateTime } from '../lib/dates'
import type { TimelineEvent } from '../types'
import './Timeline.css'

export function Timeline({
  events,
  empty = 'No activity yet.',
}: {
  events: TimelineEvent[]
  empty?: string
}) {
  if (events.length === 0) return <p className="empty">{empty}</p>

  return (
    <ol className="timeline">
      {events.map((e) => (
        <li key={e.id}>
          <div className="tl-date">{formatDate(e.createdAt)}</div>
          <div className="tl-card">
            <strong>{e.title}</strong>
            {e.body && <p>{e.body}</p>}
            <span className="tl-meta">
              {e.type.replace(/_/g, ' ')} · {formatDateTime(e.createdAt)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function TaskList({
  tasks,
  prospectName,
  onComplete,
  onDelete,
}: {
  tasks: { id: string; title: string; kind: string; dueAt: string; done: boolean }[]
  prospectName?: string
  onComplete: (id: string) => void
  onDelete?: (id: string) => void
}) {
  if (tasks.length === 0) return <p className="empty">No tasks.</p>
  return (
    <ul className="task-list">
      {tasks.map((t) => (
        <li key={t.id} className={t.done ? 'done' : ''}>
          <div>
            <span className={`pill ${t.kind}`}>{t.kind}</span>
            <strong>{t.title}</strong>
            <span>
              Due {formatDate(t.dueAt)}
              {prospectName ? ` · ${prospectName}` : ''}
            </span>
          </div>
          <div className="task-actions">
            {!t.done && (
              <button type="button" className="btn small" onClick={() => onComplete(t.id)}>
                Done
              </button>
            )}
            {onDelete && (
              <button type="button" className="btn ghost small" onClick={() => onDelete(t.id)}>
                Delete
              </button>
            )}
            {t.done && <span className="task-done-label">Done</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
