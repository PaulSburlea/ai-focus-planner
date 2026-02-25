import { useState, useEffect } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import Auth from './components/Auth'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import AiPlanCard from './components/AiPlanCard'
import ProfileMenu from './components/ProfileMenu'
import { getTasks, createTask, updateTask, deleteTask, optimizeDay } from './lib/api'
import type { Task, AiPlan, Toast } from './types'

type Theme = 'dark' | 'light'

export default function App() {
  const [session,    setSession]  = useState<Session | null>(null)
  const [authReady,  setAuthReady]= useState(false)
  const [tasks,      setTasks]    = useState<Task[]>([])
  const [aiPlan,     setAiPlan]   = useState<AiPlan | null>(null)
  const [loading,    setLoading]  = useState(false)
  const [optimizing, setOpt]      = useState(false)
  const [toast,      setToast]    = useState<Toast | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })
  const [view, setView] = useState<'today' | 'past'>('today')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setTasks([])
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadTasks() }, [session])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function loadTasks() {
    setLoading(true)
    try { setTasks(await getTasks()) }
    catch { showToast('Failed to load tasks', 'error') }
    setLoading(false)
  }

  async function handleAddTask(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>) {
    try { const t = await createTask(task); setTasks(p => [t, ...p]); showToast('Task added') }
    catch { showToast('Failed to add task', 'error') }
  }

  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    try { const u = await updateTask(id, updates); setTasks(p => p.map(t => t.id === id ? u : t)); showToast('Saved') }
    catch { showToast('Failed to update', 'error') }
  }

  async function handleDeleteTask(id: string) {
    try { await deleteTask(id); setTasks(p => p.filter(t => t.id !== id)); showToast('Deleted') }
    catch { showToast('Failed to delete', 'error') }
  }

  async function handleOptimize() {
    if (!tasks.length) { showToast('Add some tasks first', 'error'); return }
    setOpt(true)
    try { setAiPlan(await optimizeDay(tasks)); showToast('Plan ready') }
    catch { showToast('Optimization failed', 'error') }
    setOpt(false)
  }

  async function handleAcceptPlan() {
    if (!aiPlan || !tasks.length) return
    try {
      const plannedIds = new Set(aiPlan.ordered_task_ids)
      const reordered = [
        ...aiPlan.ordered_task_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean),
        ...tasks.filter(t => !plannedIds.has(t.id))
      ] as Task[]

      await Promise.all(
        reordered.map((t, i) => updateTask(t.id, {
          sort_order: i,
          ...(plannedIds.has(t.id) ? { ai_plan: aiPlan } : {})
        }))
      )

      setTasks(reordered.map((t, i) => ({
        ...t,
        sort_order: i,
        ...(plannedIds.has(t.id) ? { ai_plan: aiPlan } : {})
      })))

      showToast('Plan applied!')
      setAiPlan(null)
    } catch { showToast('Failed to save plan', 'error') }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    showToast('Signed out')
  }

  // ── Stats ──
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const activeTasks    = tasks.filter(t => !t.completed)
  const todayActiveTasks = activeTasks.filter(t => {
    if (!t.deadline) return false
    const d = new Date(t.deadline)
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth() &&
           d.getDate()     === today.getDate()
  })
  const todayMinutes = todayActiveTasks.reduce((s, t) => s + t.estimate_minutes, 0)
  const todayHours   = (todayMinutes / 60).toFixed(1)

  // ── Filtrare după view ──
  // Today: tasks active (necompletate) cu deadline azi/viitor sau fara deadline
  // Past: tasks cu deadline trecut + TOATE taskurile completate
  const filteredTasks = tasks.filter(t => {
    if (view === 'past') {
      // deadline in trecut SAU task completat
      if (t.completed) return true
      if (!t.deadline) return false
      const d = new Date(t.deadline); d.setHours(0, 0, 0, 0)
      return d < today
    } else {
      // view === 'today': doar active, deadline azi/viitor sau fara deadline
      if (t.completed) return false
      if (!t.deadline) return true
      const d = new Date(t.deadline); d.setHours(0, 0, 0, 0)
      return d >= today
    }
  })

  const pastCompleted  = filteredTasks.filter(t => t.completed).length
  const pastIncomplete = filteredTasks.filter(t => !t.completed).length

  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</span>
      </div>
    )
  }

  if (!session) return <Auth />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Header ── */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto',
          padding: '0 32px', height: 62,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--accent)'
            }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Focus Planner
            </span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Today's summary pill */}
            <div className="header-stats" style={{
              display: 'flex', alignItems: 'center', gap: 0,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden', marginRight: 4
            }}>
              <div style={{ padding: '0 16px', height: 34, display: 'flex', alignItems: 'center', gap: 6, borderRight: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{todayActiveTasks.length}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>tasks today</span>
              </div>
              <div style={{ padding: '0 16px', height: 34, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{todayHours}h</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>scheduled</span>
              </div>
            </div>

            {/* Theme toggle — same size as avatar (34×34) */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, transition: 'all 0.15s', flexShrink: 0
              }}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Profile */}
            <ProfileMenu session={session} tasks={tasks} onSignOut={handleSignOut} />

            <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

            {/* Optimize CTA */}
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 18px', height: 34, fontSize: 13 }}
            >
              {optimizing
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span><span>Thinking...</span></>
                : <><span>✦</span><span>Optimize my day</span></>
              }
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 32px' }}>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 4, width: 'fit-content'
        }}>
          {([
            { key: 'today', label: '📌 Today & Upcoming' },
            { key: 'past',  label: '🗂 Past & Completed' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                padding: '7px 18px', borderRadius: 9,
                fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                transition: 'all 0.15s',
                background: view === tab.key ? 'var(--accent)' : 'transparent',
                color: view === tab.key ? 'var(--accent-fg)' : 'var(--text-2)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="main-grid">

          {/* Left — form + sidebar */}
          <div className="form-sticky" style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            position: 'sticky', top: 78
          }}>
            {view === 'today' && (
              <TaskForm onTaskAdded={handleAddTask} />
            )}

            {view === 'past' && (
              <div className="card" style={{ padding: '20px 24px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                  Past summary
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Total',      value: filteredTasks.length },
                    { label: 'Completed',  value: pastCompleted },
                    { label: 'Incomplete', value: pastIncomplete },
                  ].map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 14px', background: 'var(--surface-2)', borderRadius: 10
                    }}>
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{s.label}</span>
                      <span style={{
                        fontSize: 16, fontWeight: 700,
                        color: 'var(--accent)', fontVariantNumeric: 'tabular-nums'
                      }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — task list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {aiPlan && view === 'today' && (
              <div className="fade-in">
                <AiPlanCard
                  plan={aiPlan}
                  tasks={tasks}
                  onAccept={handleAcceptPlan}
                  onReject={() => setAiPlan(null)}
                />
              </div>
            )}
            {loading
              ? <div style={{ textAlign: 'center', color: 'var(--text-2)', padding: '80px 0', fontSize: 13 }}>Loading...</div>
              : <TaskList tasks={filteredTasks} onDelete={handleDeleteTask} onUpdate={handleUpdateTask} />
            }
          </div>
        </div>
      </main>

      {/* ── Toast ── */}
      {toast && (
        <div className="fade-in" style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: 'var(--surface)',
          border: `1px solid ${toast.type === 'error' ? 'var(--danger)' : 'var(--border-2)'}`,
          color: toast.type === 'error' ? 'var(--danger)' : 'var(--text)',
          padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: 'var(--shadow)'
        }}>
          {toast.type === 'error' ? '⚠ ' : '✓ '}{toast.message}
        </div>
      )}
    </div>
  )
}