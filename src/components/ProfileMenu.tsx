import { useState, useRef, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Task } from '../types'

interface Props {
  session: Session
  tasks: Task[]
  onSignOut: () => void
}

export default function ProfileMenu({ session, tasks, onSignOut }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Închide la click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const completedTasks = tasks.filter(t => t.completed)
  const activeTasks    = tasks.filter(t => !t.completed)
  const totalMinutes   = tasks.reduce((s, t) => s + t.estimate_minutes, 0)
  const initials       = session.user.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Avatar button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: 34, height: 34, borderRadius: 10,
          background: open ? 'var(--accent)' : 'var(--surface-2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? 'var(--accent-fg)' : 'var(--text)',
          fontFamily: 'Fira Code, monospace',
          fontSize: 11, fontWeight: 700,
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
          flexShrink: 0
        }}
      >
        {initials}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="fade-in"
          style={{
            position: 'absolute', top: 42, right: 0,
            width: 260, zIndex: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden'
          }}
        >
          {/* User info */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Fira Code, monospace', fontSize: 13,
                fontWeight: 700, color: 'var(--accent)', flexShrink: 0
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session.user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Stats</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Total', value: tasks.length },
                { label: 'Active', value: activeTasks.length },
                { label: 'Done', value: completedTasks.length },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--surface-2)', borderRadius: 8,
                  padding: '8px 6px', textAlign: 'center'
                }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Fira Code, monospace', lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-2)' }}>Total time tracked</span>
              <span style={{ fontSize: 12, fontFamily: 'Fira Code, monospace', color: 'var(--text)', fontWeight: 600 }}>
                {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ padding: '8px' }}>
            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              style={{
                width: '100%', padding: '9px 12px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: 8, fontSize: 13,
                color: 'var(--danger)',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-dim)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>↗</span> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}