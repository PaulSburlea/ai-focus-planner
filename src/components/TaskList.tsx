import { useState } from 'react'
import type { Task } from '../types'

interface Props {
  tasks: Task[]
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>
}

const PRESETS = [15, 30, 45, 60, 90, 120]

function formatMinutes(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60); const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getDeadlineInfo(deadline: string) {
  const d = new Date(deadline); const now = new Date()
  const diff = d.getTime() - now.getTime()
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  const str   = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (diff < 0)    return { str, tag: 'OVERDUE', color: '#f87171' }
  if (hours < 3)   return { str, tag: 'due soon', color: '#fb923c' }
  if (days < 1)    return { str, tag: 'today', color: '#facc15' }
  return { str, tag: null, color: 'var(--text-2)' }
}

function groupTasksByDay(tasks: Task[]) {
  const groups: { label: string; tasks: Task[] }[] = []
  const today    = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

  const noDeadline: Task[] = []
  const todayTasks: Task[] = []
  const tomorrowTasks: Task[] = []
  const laterTasks: Task[] = []
  const pastTasks: Task[] = []

  tasks.forEach(t => {
    if (!t.deadline) { noDeadline.push(t); return }
    const d = new Date(t.deadline); d.setHours(0,0,0,0)
    if (d < today)                               pastTasks.push(t)
    else if (d.getTime() === today.getTime())     todayTasks.push(t)
    else if (d.getTime() === tomorrow.getTime())  tomorrowTasks.push(t)
    else                                         laterTasks.push(t)
  })

  if (pastTasks.length)     groups.push({ label: '⚠ Overdue',    tasks: pastTasks })
  if (todayTasks.length)    groups.push({ label: '📌 Today',      tasks: todayTasks })
  if (tomorrowTasks.length) groups.push({ label: '📅 Tomorrow',   tasks: tomorrowTasks })
  if (laterTasks.length)    groups.push({ label: '🗓 Later',      tasks: laterTasks })
  if (noDeadline.length)    groups.push({ label: '◎ No deadline', tasks: noDeadline })

  return groups
}

// ── stilul numeric comun — DM Sans + tabular-nums ─────
const numericStyle: React.CSSProperties = {
  fontFamily: 'DM Sans, sans-serif',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  letterSpacing: '-0.01em',
}

// ── Modal ──────────────────────────────────────────────
function TaskModal({ task, onClose, onSave, onDelete, onComplete }: {
  task: Task
  onClose: () => void
  onSave: (id: string, updates: Partial<Task>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
}) {
  const [editing,    setEditing]    = useState(false)
  const [title,      setTitle]      = useState(task.title)
  const [estimate,   setEstimate]   = useState(String(task.estimate_minutes))
  const [deadlineDate, setDeadlineDate] = useState(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '')
  const [deadlineTime, setDeadlineTime] = useState(task.deadline ? new Date(task.deadline).toTimeString().slice(0,5) : '09:00')
  const [notes,      setNotes]      = useState(task.notes || '')
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [completing, setCompleting] = useState(false)

  const dl = task.deadline ? getDeadlineInfo(task.deadline) : null

  async function handleSave() {
    setSaving(true)
    let deadline: string | null = null
    if (deadlineDate) deadline = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
    await onSave(task.id, {
      title: title.trim(),
      estimate_minutes: parseInt(estimate),
      deadline,
      notes: notes.trim() || null,
    })
    setSaving(false)
    onClose()
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(task.id)
    setDeleting(false)
    onClose()
  }

  async function handleComplete() {
    setCompleting(true)
    await onComplete(task.id)
    setCompleting(false)
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease'
      }} />

      <div style={{
        position: 'fixed', zIndex: 201,
        top: '50%', left: '50%',
        width: 'calc(100% - 32px)', maxWidth: 480,
        animation: 'modalIn 0.2s cubic-bezier(0.34,1.4,0.64,1) forwards'
      }}>
        <div className="card" style={{ padding: 28, boxShadow: 'var(--shadow-lg)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {editing ? 'Edit task' : 'Task details'}
            </p>
            <button onClick={onClose} className="btn-icon" style={{ fontSize: 18, lineHeight: 1 }}>×</button>
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="field-label">Title</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="field-label">Duration</label>
                <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
                  {PRESETS.map(p => (
                    <button key={p} type="button"
                      onClick={() => setEstimate(String(p))}
                      className={`preset-btn ${estimate === String(p) ? 'active' : ''}`}
                    >{formatMinutes(p)}</button>
                  ))}
                </div>
                <input type="number" value={estimate} onChange={e => setEstimate(e.target.value)}
                  className="input-field" min="1" placeholder="Custom minutes" />
              </div>
              <div>
                <label className="field-label">Deadline</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                  <input type="date" value={deadlineDate} onChange={e => setDeadlineDate(e.target.value)} className="input-field" />
                  <input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} className="input-field" style={{ width: 110 }} />
                </div>
                {deadlineDate && (
                  <button type="button" onClick={() => { setDeadlineDate(''); setDeadlineTime('09:00') }}
                    style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 6, padding: 0 }}>
                    ✕ Remove deadline
                  </button>
                )}
              </div>
              <div>
                <label className="field-label">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="input-field" placeholder="Context, links..." />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 1, padding: 11 }}>
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <button onClick={() => setEditing(false)} className="btn-ghost">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 16, lineHeight: 1.3 }}>
                {task.title}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', opacity: 0.5 }}>⏱</span>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Duration</span>
                  <span style={{ marginLeft: 'auto', ...numericStyle, fontSize: 13, color: 'var(--text)' }}>
                    {formatMinutes(task.estimate_minutes)}
                  </span>
                </div>

                {dl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, width: 18, textAlign: 'center', opacity: 0.5 }}>📅</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Deadline</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {dl.tag && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: dl.color, background: `${dl.color}18`, padding: '2px 7px', borderRadius: 5 }}>
                          {dl.tag.toUpperCase()}
                        </span>
                      )}
                      <span style={{ ...numericStyle, fontSize: 13, color: dl.color }}>{dl.str}</span>
                    </div>
                  </div>
                )}

                {task.notes && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 13, width: 18, textAlign: 'center', opacity: 0.5, flexShrink: 0 }}>📝</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{task.notes}</span>
                  </div>
                )}

                {task.ai_plan && (
                  <div style={{
                    marginTop: 6, padding: '10px 14px',
                    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                    borderRadius: 10, fontSize: 12, color: 'var(--accent)',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <span>✦</span><span>This task has an AI plan assigned</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {task.completed ? (
                  /* ── Task completat → Reopen ── */
                  <button
                    onClick={async () => { await onSave(task.id, { completed: false }); onClose() }}
                    style={{
                      width: '100%', padding: 11,
                      background: 'var(--surface-2)', color: 'var(--text)',
                      border: '1px solid var(--border)', borderRadius: 10,
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--border-2)'
                      e.currentTarget.style.background = 'var(--surface-3)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                      e.currentTarget.style.background = 'var(--surface-2)'
                    }}
                  >
                    <span>↩</span> Reopen task
                  </button>
                ) : (
                  /* ── Task activ → Mark as done ── */
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    style={{
                      width: '100%', padding: 11,
                      background: '#16a34a', color: '#fff',
                      border: 'none', borderRadius: 10,
                      fontFamily: 'DM Sans, sans-serif',
                      fontWeight: 600, fontSize: 13.5, cursor: 'pointer',
                      opacity: completing ? 0.5 : 1,
                      transition: 'opacity 0.15s, transform 0.1s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7
                    }}
                  >
                    {completing ? 'Marking...' : <><span>✓</span> Mark as done</>}
                  </button>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(true)} className="btn-ghost" style={{ flex: 1 }}>
                    Edit task
                  </button>
                  <button onClick={handleDelete} disabled={deleting} className="btn-ghost"
                    style={{ color: 'var(--danger)', borderColor: 'transparent', opacity: deleting ? 0.5 : 1 }}>
                    {deleting ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Task Card ──────────────────────────────────────────
function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const dl = task.deadline ? getDeadlineInfo(task.deadline) : null
  const slot = task.ai_plan?.slots?.find(s => s.taskId === task.id)

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="card fade-in" onClick={onClick}
      style={{ padding: '16px 20px', cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 3, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0, minHeight: 28,
          background: task.ai_plan ? 'var(--accent)' : dl?.color === '#f87171' ? '#f87171' : 'var(--border-2)'
        }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.title}
            </p>
            {task.ai_plan && (
              <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>✦ AI</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {slot ? (
              /* ora din AI plan — DM Sans tabular-nums */
              <span style={{
                ...numericStyle,
                fontSize: 13,
                color: 'var(--accent)',
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent)',
                borderRadius: 5,
                padding: '1px 7px'
              }}>
                {formatTime(slot.start)} → {formatTime(slot.end)}
              </span>
            ) : (
              /* durata estimata */
              <span style={{ ...numericStyle, fontSize: 13, color: 'var(--text-2)' }}>
                {formatMinutes(task.estimate_minutes)}
              </span>
            )}

            {dl && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: dl.color }}>
                  {dl.tag ? `${dl.tag} · ` : ''}{dl.str}
                </span>
              </>
            )}

            {task.notes && (
              <>
                <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                  {task.notes}
                </span>
              </>
            )}
          </div>
        </div>

        <span style={{ fontSize: 16, color: 'var(--text-3)', flexShrink: 0 }}>›</span>
      </div>
    </div>
  )
}

// ── Completed Task Card ────────────────────────────────
function CompletedCard({ task, onReopen, onClick }: { task: Task; onReopen: () => void; onClick: () => void }) {
  return (
    <div className="card fade-in" onClick={onClick}
      style={{ padding: '11px 16px', cursor: 'pointer', userSelect: 'none', opacity: 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0, minHeight: 24, background: '#16a34a' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onReopen() }}
          className="btn-ghost"
          style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}
        >
          Reopen
        </button>
      </div>
    </div>
  )
}

// ── Main Export ────────────────────────────────────────
export default function TaskList({ tasks, onDelete, onUpdate }: Props) {
  const [selectedTask,  setSelectedTask]  = useState<Task | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    '🗓 Later': true,
    '📅 Tomorrow': false,
  })

  const activeTasks    = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)

  async function handleComplete(id: string) { await onUpdate(id, { completed: true }) }
  async function handleReopen(id: string)   { await onUpdate(id, { completed: false }) }

  const alwaysOpen = ['⚠ Overdue', '📌 Today', '◎ No deadline']

  function toggleCollapse(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-2)' }}>
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.2 }}>◎</div>
        <p style={{ fontSize: 14, fontWeight: 500 }}>No tasks yet</p>
        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-3)' }}>Add your first task to get started</p>
      </div>
    )
  }

  const groups = groupTasksByDay(activeTasks)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {activeTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>All done for today!</p>
            <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-3)' }}>No active tasks remaining</p>
          </div>
        ) : (
          groups.map(group => {
            const isCollapsible = !alwaysOpen.includes(group.label)
            const isCollapsed   = isCollapsible && collapsed[group.label]

            return (
              <div key={group.label}>
                <div
                  onClick={() => isCollapsible && toggleCollapse(group.label)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: isCollapsed ? 0 : 10,
                    cursor: isCollapsible ? 'pointer' : 'default',
                    userSelect: 'none', padding: '4px 0', borderRadius: 6,
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => { if (isCollapsible) (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{group.label}</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {group.tasks.length}
                    {isCollapsible && (
                      <span style={{
                        fontSize: 14, color: 'var(--text-2)',
                        transition: 'transform 0.2s', display: 'inline-block',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                      }}>▾</span>
                    )}
                  </span>
                </div>

                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {group.tasks.map(task => (
                      <TaskCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {completedTasks.length > 0 && (
          <div>
            <div
              onClick={() => setShowCompleted(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: showCompleted ? 10 : 0,
                cursor: 'pointer', userSelect: 'none', padding: '4px 0',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.7' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a' }}>✓ Completed</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 6 }}>
                {completedTasks.length}
                <span style={{
                  fontSize: 14, color: '#16a34a',
                  transition: 'transform 0.2s', display: 'inline-block',
                  transform: showCompleted ? 'rotate(0deg)' : 'rotate(-90deg)'
                }}>▾</span>
              </span>
            </div>

            {showCompleted && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {completedTasks.map(task => (
                  <CompletedCard
                    key={task.id}
                    task={task}
                    onReopen={() => handleReopen(task.id)}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onSave={async (id, updates) => { await onUpdate(id, updates); setSelectedTask(null) }}
          onDelete={async (id) => { await onDelete(id); setSelectedTask(null) }}
          onComplete={async (id) => { await handleComplete(id); setSelectedTask(null) }}
        />
      )}
    </>
  )
}