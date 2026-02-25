import type { Task, AiPlan } from '../types'

interface Props {
  plan: AiPlan
  tasks: Task[]
  onAccept: () => void
  onReject: () => void
}

export default function AiPlanCard({ plan, tasks, onAccept, onReject }: Props) {
  function getTaskTitle(taskId: string) {
    const task = tasks.find(t => t.id === taskId)
    return task ? task.title : taskId
  }

  function formatTime(isoString: string) {
    return new Date(isoString).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="card-ai" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-glow)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--accent)' }}>✦</div>
          <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>AI Plan</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAccept} className="btn-primary" style={{ fontSize: 12, padding: '7px 16px' }}>Accept & Save</button>
          <button onClick={onReject} className="btn-ghost">Discard</button>
        </div>
      </div>

      {/* Rationale */}
      <div style={{
        background: 'var(--accent-glow)',
        border: '1px solid rgba(167,139,250,0.2)',
        borderRadius: 10, padding: '12px 16px',
        fontSize: 13, color: 'var(--muted)',
        marginBottom: 20, lineHeight: 1.6
      }}>
        {plan.rationale}
      </div>

      {/* Schedule */}
      {plan.slots && plan.slots.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 10 }}>Schedule</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.slots.map((slot, i) => (
              <div key={i} className="slot-card">
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--accent)', minWidth: 100 }}>
                  {formatTime(slot.start)} → {formatTime(slot.end)}
                </div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{getTaskTitle(slot.taskId)}</div>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>#{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order */}
      <div>
        <p style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 10 }}>Priority</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {plan.ordered_task_ids.map((id, i) => (
            <span key={id} style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 20,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontWeight: 400
            }}>
              <span style={{ color: 'var(--accent)', marginRight: 6, fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}.</span>
              {getTaskTitle(id)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}