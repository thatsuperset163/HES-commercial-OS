import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSales } from '../store/SalesContext'
import { formatDate, formatMoney } from '../lib/dates'
import {
  BOARD_STAGES,
  boardStageId,
  columnJobValue,
  groupProspectsByBoardStage,
  type BoardStageId,
} from '../lib/pipelineBoard'
import { STAGES, type Prospect } from '../types'
import './Pipeline.css'

function stageLabel(stage: Prospect['stage']) {
  return STAGES.find((s) => s.id === stage)?.label ?? stage
}

export function Pipeline() {
  const { state, moveBoardStage } = useSales()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<BoardStageId | null>(null)
  const [hideClosed, setHideClosed] = useState(true)

  const groups = useMemo(
    () => groupProspectsByBoardStage(state.prospects),
    [state.prospects],
  )

  const columns = hideClosed
    ? BOARD_STAGES.filter((s) => s.id !== 'won' && s.id !== 'lost')
    : BOARD_STAGES

  const openCount = state.prospects.filter(
    (p) => boardStageId(p) !== 'won' && boardStageId(p) !== 'lost',
  ).length
  const openValue = columnJobValue(
    state.prospects.filter(
      (p) => boardStageId(p) !== 'won' && boardStageId(p) !== 'lost',
    ),
  )

  function onDrop(stageId: BoardStageId) {
    if (!draggingId) return
    const prospect = state.prospects.find((p) => p.id === draggingId)
    if (prospect && boardStageId(prospect) !== stageId) {
      moveBoardStage(draggingId, stageId)
    }
    setDraggingId(null)
    setOverStage(null)
  }

  return (
    <div className="page pipeline-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Commercial pipeline</p>
          <h1>Pipeline</h1>
          <p className="lede">
            Drag deals across stages. Focus on moving the next one forward.
          </p>
        </div>
        <div className="pipeline-header-actions">
          <label className="pipeline-toggle">
            <input
              type="checkbox"
              checked={hideClosed}
              onChange={(e) => setHideClosed(e.target.checked)}
            />
            Hide won / lost
          </label>
          <Link className="btn secondary" to="/prospects">
            Prospect list
          </Link>
        </div>
      </header>

      <p className="open-line muted">
        {openCount} open · {formatMoney(openValue)} job value · drag a card to
        change stage
      </p>

      <div className={`pipeline-board${hideClosed ? '' : ' show-closed'}`} role="list">
        {columns.map((column) => {
          const cards = groups[column.id]
          const value = columnJobValue(cards)
          return (
            <section
              key={column.id}
              className={`pipeline-column${overStage === column.id ? ' drop-target' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverStage(column.id)
              }}
              onDragLeave={() => {
                setOverStage((current) =>
                  current === column.id ? null : current,
                )
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(column.id)
              }}
            >
              <header className="pipeline-column-head">
                <div>
                  <h2>{column.label}</h2>
                  <span>
                    {cards.length} · {formatMoney(value)}
                  </span>
                </div>
              </header>
              <ul className="pipeline-cards">
                {cards.map((p) => (
                  <li key={p.id}>
                    <article
                      className={`pipeline-card${draggingId === p.id ? ' dragging' : ''}${p.priority === 'high' ? ' high' : ''}`}
                      draggable
                      onDragStart={() => setDraggingId(p.id)}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setOverStage(null)
                      }}
                    >
                      <Link to={`/prospects/${p.id}`} className="pipeline-card-link">
                        <strong>
                          {p.decisionMaker || p.businessName}
                        </strong>
                        <span className="pipeline-card-company">
                          {p.businessName}
                          {p.city ? ` · ${p.city}` : ''}
                        </span>
                      </Link>
                      <div className="pipeline-card-meta">
                        <span className="stage-tag">{stageLabel(p.stage)}</span>
                        <span className={`priority-tag ${p.priority}`}>
                          {p.priority}
                        </span>
                      </div>
                      <div className="pipeline-card-foot">
                        <span>
                          {p.estimatedJobValue != null
                            ? formatMoney(Number(p.estimatedJobValue))
                            : 'No job value'}
                        </span>
                        <span>
                          {p.nextFollowUpAt
                            ? `Follow-up ${formatDate(p.nextFollowUpAt)}`
                            : 'No follow-up'}
                        </span>
                      </div>
                    </article>
                  </li>
                ))}
                {cards.length === 0 && (
                  <li className="pipeline-empty">Drop a deal here</li>
                )}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
