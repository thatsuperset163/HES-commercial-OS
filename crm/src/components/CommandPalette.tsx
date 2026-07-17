import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import { formatDate } from '../lib/dates'
import './Overlay.css'

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { searchAll, state } = useSales()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    if (!q.trim()) {
      return {
        prospects: state.prospects.slice(0, 6),
        tasks: state.tasks.filter((t) => !t.done).slice(0, 4),
        timeline: [] as typeof state.timeline,
      }
    }
    const found = searchAll(q)
    return {
      prospects: found.prospects.slice(0, 8),
      tasks: found.tasks.slice(0, 6),
      timeline: found.timeline.slice(0, 6),
    }
  }, [q, searchAll, state])

  const flat = useMemo(() => {
    const items: { kind: string; id: string; label: string; sub: string; go: () => void }[] = []
    for (const p of results.prospects) {
      items.push({
        kind: 'Prospect',
        id: p.id,
        label: p.businessName,
        sub: `${p.decisionMaker} · ${p.city} · ${p.stage.replace(/_/g, ' ')}`,
        go: () => navigate(`/prospects/${p.id}`),
      })
    }
    for (const t of results.tasks) {
      const p = state.prospects.find((x) => x.id === t.prospectId)
      items.push({
        kind: 'Task',
        id: t.id,
        label: t.title,
        sub: `${p?.businessName ?? 'Prospect'} · due ${formatDate(t.dueAt)}`,
        go: () => navigate(`/prospects/${t.prospectId}`),
      })
    }
    for (const e of results.timeline) {
      const p = state.prospects.find((x) => x.id === e.prospectId)
      items.push({
        kind: 'Timeline',
        id: e.id,
        label: e.title,
        sub: `${p?.businessName ?? ''} · ${e.body.slice(0, 60)}`,
        go: () => navigate(`/prospects/${e.prospectId}`),
      })
    }
    return items
  }, [results, state.prospects, navigate])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setIdx(0)
  }, [q])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIdx((i) => Math.min(i + 1, Math.max(0, flat.length - 1)))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = flat[idx]
        if (item) {
          item.go()
          onClose()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flat, idx, onClose])

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-input palette-input"
          placeholder="Search prospects, tasks, timeline…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ul className="palette-list">
          {flat.length === 0 && <li className="empty padded">No matches.</li>}
          {flat.map((item, i) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                className={i === idx ? 'palette-row active' : 'palette-row'}
                onMouseEnter={() => setIdx(i)}
                onClick={() => {
                  item.go()
                  onClose()
                }}
              >
                <span className="pill">{item.kind}</span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.sub}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="help-card panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>Keyboard shortcuts</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <ul className="help-list">
          <li><span className="kbd">⌘/Ctrl K</span> Search everywhere</li>
          <li><span className="kbd">G</span> then <span className="kbd">D</span> Today</li>
          <li><span className="kbd">G</span> then <span className="kbd">L</span> Pipeline</li>
          <li><span className="kbd">G</span> then <span className="kbd">P</span> Prospects</li>
          <li><span className="kbd">G</span> then <span className="kbd">E</span> Emails</li>
          <li><span className="kbd">G</span> then <span className="kbd">A</span> Analytics</li>
          <li><span className="kbd">N</span> Focus new task (on prospect)</li>
          <li><span className="kbd">?</span> This help</li>
          <li><span className="kbd">Esc</span> Close overlays</li>
        </ul>
      </div>
    </div>
  )
}
