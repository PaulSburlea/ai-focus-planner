import { useState } from 'react'
import type { Task } from '../types'

/**
 * Props for the TaskForm component.
 * 
 * @interface Props
 * @property {(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>) => Promise<void>} onTaskAdded 
 *           Callback function triggered when a new task is successfully submitted. 
 *           Receives the task data without system-generated fields (id, timestamps, etc.).
 */
interface Props {
  onTaskAdded: (task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>) => Promise<void>
}

/**
 * Predefined duration options to allow quick selection of common time estimates.
 */
const PRESETS = [
  { label: '15m', value: 15 },
  { label: '30m', value: 30 },
  { label: '45m', value: 45 },
  { label: '1h',  value: 60 },
  { label: '90m', value: 90 },
  { label: '2h',  value: 120 },
]

/**
 * Formats a duration in minutes into a human-readable string (e.g., "1h 30m").
 * 
 * @param {number} min - The duration in minutes.
 * @returns {string} The formatted time string.
 */
function formatMinutes(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

/**
 * A form component for creating new tasks.
 * 
 * Features:
 * - Title input.
 * - Duration estimation via presets or custom numeric input.
 * - Optional deadline date/time picker.
 * - Optional notes field.
 * 
 * @param {Props} props - The component props.
 * @returns {JSX.Element} The rendered task creation form.
 */
export default function TaskForm({ onTaskAdded }: Props) {
  const [title,        setTitle]        = useState('')
  const [estimate,     setEstimate]     = useState('')
  const [deadlineDate, setDeadlineDate] = useState('')
  const [deadlineTime, setDeadlineTime] = useState('09:00')
  const [notes,        setNotes]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showDeadline, setShowDeadline] = useState(false)

  /**
   * Handles the form submission.
   * Validates inputs, constructs the deadline timestamp, and calls the parent handler.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    // Basic validation: Title and estimate are required
    if (!title.trim() || !estimate) return
    
    setLoading(true)

    let deadline: string | null = null
    
    // Construct ISO timestamp if a deadline is set
    if (showDeadline && deadlineDate) {
      // Combines date and time strings into a valid ISO format
      deadline = new Date(`${deadlineDate}T${deadlineTime}`).toISOString()
    }

    await onTaskAdded({
      title: title.trim(),
      estimate_minutes: parseInt(estimate),
      deadline,
      notes: notes.trim() || null,
      completed: false,
    })

    // Reset form state after successful submission
    setTitle('')
    setEstimate('')
    setDeadlineDate('')
    setDeadlineTime('09:00')
    setNotes('')
    setShowDeadline(false)
    setLoading(false)
  }

  // Calculate today's date string (YYYY-MM-DD) to set the minimum allowed date in the picker
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="card" style={{ padding: 26 }}>
      {/* Header */}
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'var(--accent)', flexShrink: 0
        }}>+</div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>New task</p>
          <p style={{ fontSize: 11, color: 'var(--text-2)' }}>Add to today's queue</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Title Input */}
        <div>
          <label className="field-label">What needs to be done?</label>
          <input
            type="text"
            placeholder="e.g. Write project report"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input-field"
            required
          />
        </div>

        {/* Duration Input & Presets */}
        <div>
          <label className="field-label">Duration</label>
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button key={p.value} type="button"
                onClick={() => setEstimate(String(p.value))}
                className={`preset-btn ${estimate === String(p.value) ? 'active' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <input
            type="number"
            placeholder="Or type custom minutes"
            value={estimate}
            onChange={e => setEstimate(e.target.value)}
            className="input-field"
            min="1"
            required
          />
          {estimate && (
            <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 5, fontFamily: 'DM Mono, monospace' }}>
              = {formatMinutes(parseInt(estimate) || 0)}
            </p>
          )}
        </div>

        {/* Deadline Toggle & Inputs */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showDeadline ? 10 : 0 }}>
            <label className="field-label" style={{ margin: 0 }}>Deadline</label>
            <button
              type="button"
              onClick={() => setShowDeadline(v => !v)}
              style={{
                fontSize: 11, fontWeight: 600,
                color: showDeadline ? 'var(--danger)' : 'var(--accent)',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              {showDeadline ? '✕ Remove' : '+ Add deadline'}
            </button>
          </div>

          {showDeadline && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
              {/* Date picker - custom styled */}
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={deadlineDate}
                  min={todayStr}
                  onChange={e => setDeadlineDate(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 36 }}
                />
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, pointerEvents: 'none', opacity: 0.5
                }}>📅</span>
              </div>

              {/* Time picker */}
              <div style={{ position: 'relative' }}>
                <input
                  type="time"
                  value={deadlineTime}
                  onChange={e => setDeadlineTime(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: 36, width: 110 }}
                />
                <span style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14, pointerEvents: 'none', opacity: 0.5
                }}>🕐</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes Input */}
        <div>
          <label className="field-label">Notes <span style={{ color: 'var(--text-3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
          <textarea
            placeholder="Context, links, sub-tasks..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="input-field"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !title.trim() || !estimate}
          className="btn-primary"
          style={{ width: '100%', padding: '11px', marginTop: 2 }}
        >
          {loading ? 'Adding...' : 'Add task →'}
        </button>
      </form>
    </div>
  )
}