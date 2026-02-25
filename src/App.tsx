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
  const [theme,      setTheme]    = useState<Theme>('dark')
  const [view,       setView]     = useState<'today' | 'past'>('today')

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
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])

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

  async function handleAddTask(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id'>) {
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
      await Promise.all(
        tasks.filter(t => plannedIds.has(t.id)).map(t => updateTask(t.id, { ai_plan: aiPlan }))
      )
      const reordered = [
        ...aiPlan.ordered_task_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean),
        ...tasks.filter(t => !plannedIds.has(t.id))
      ] as Task[]
      setTasks(reordered)
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

  const todayOnlyTasks = tasks.filter(t => {
    if (!t.deadline) return false
    const d = new Date(t.deadline)
    const now = new Date()
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth()    === now.getMonth() &&
           d.getDate()     === now.getDate()
  })
  const todayMinutes = todayOnlyTasks.reduce((s, t) => s + t.estimate_minutes, 0)
  const todayHours   = (todayMinutes / 60).toFixed(1)

  // ── Filtrare după view ──
  const filteredTasks = tasks.filter(t => {
    if (!t.deadline) return view === 'today'
    const d = new Date(t.deadline); d.setHours(0, 0, 0, 0)
    return view === 'today' ? d >= today : d < today
  })

  // ── Auth loading ──
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
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 50, boxShadow: 'var(--shadow-sm)' }}>
        <div className="header-inner" style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <img src="/logo.png" alt="" style={{ height: 26 }} onError={e => (e.currentTarget.style.display = 'none')} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Focus Planner</span>
            <span className="badge badge-accent" style={{ fontSize: 10 }}>AI</span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

            {/* Stats */}
            <div className="header-stats" style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '6px 14px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'Fira Code, monospace', lineHeight: 1 }}>{todayOnlyTasks.length}</span>
                <span style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>today</span>
              </div>
              <div style={{ padding: '6px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'Fira Code, monospace', lineHeight: 1 }}>{todayHours}h</span>
                <span style={{ fontSize: 9, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>scheduled</span>
              </div>
            </div>

            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

            {/* Theme toggle */}
            <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="btn-icon" style={{ fontSize: 14 }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Profile menu */}
            <ProfileMenu session={session} tasks={tasks} onSignOut={handleSignOut} />

            <div style={{ width: 1, height: 24, background: 'var(--border)' }} />

            {/* Optimize CTA */}
            <button onClick={handleOptimize} disabled={optimizing} className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px' }}>
              {optimizing
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 13 }}>◌</span><span>Thinking...</span></>
                : <><span style={{ fontSize: 13 }}>✦</span><span>Optimize my day</span></>
              }
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main-wrap" style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 24px' }}>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {([
            { key: 'today', label: '📌 Today & Upcoming' },
            { key: 'past',  label: '🗂 Past tasks' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              style={{
                padding: '7px 16px', borderRadius: 9,
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

          {/* Left — form + stats (doar pe Today) */}
          <div className="form-sticky" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 84 }}>
            {view === 'today' && (
              <>
                <TaskForm onTaskAdded={handleAddTask} />
                <div className="card" style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                  {[
                    { label: 'Today',  value: todayOnlyTasks.length },
                    { label: 'Hours',  value: `${todayHours}h` },
                    { label: 'Mins',   value: todayMinutes },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', borderRight: i < 2 ? '1px solid var(--border)' : 'none', padding: '4px 8px' }}>
                      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Fira Code, monospace', lineHeight: 1.2 }}>{s.value}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {view === 'past' && (
              <div className="card" style={{ padding: '20px' }}>
                <p style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Past summary</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: 'Past tasks', value: filteredTasks.length },
                    { label: 'Completed',  value: filteredTasks.filter(t => t.completed).length },
                    { label: 'Incomplete', value: filteredTasks.filter(t => !t.completed).length },
                  ].map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 9 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{s.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'Fira Code, monospace' }}>{s.value}</span>
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
                <AiPlanCard plan={aiPlan} tasks={tasks} onAccept={handleAcceptPlan} onReject={() => setAiPlan(null)} />
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