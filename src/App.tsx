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

/**
 * Represents the application's visual theme.
 */
type Theme = 'dark' | 'light'

/**
 * The root component of the application.
 * 
 * Manages global state including:
 * - User authentication session.
 * - Task data and AI optimization plans.
 * - UI state (loading, toasts, theme, current view).
 * 
 * @returns {JSX.Element} The rendered application.
 */
export default function App() {
  const [session,    setSession]  = useState<Session | null>(null)
  const [authReady,  setAuthReady]= useState(false)
  const [tasks,      setTasks]    = useState<Task[]>([])
  const [aiPlan,     setAiPlan]   = useState<AiPlan | null>(null)
  const [loading,    setLoading]  = useState(false)
  const [optimizing, setOpt]      = useState(false)
  const [toast,      setToast]    = useState<Toast | null>(null)
  
  // Initialize theme from local storage or default to 'dark'
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark'
  })
  
  // Toggle between 'today' (active/upcoming) and 'past' (completed/overdue) views
  const [view, setView] = useState<'today' | 'past'>('today')

  // ── Authentication & Session Management ──────────────────────────────────────────
  useEffect(() => {
    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })

    // Listen for auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) setTasks([]) // Clear tasks on sign out
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Load tasks whenever a valid session is established
  useEffect(() => { if (session) loadTasks() }, [session])

  // Apply theme changes to the document root and persist to local storage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  /**
   * Displays a temporary toast notification.
   * 
   * @param {string} message - The text to display.
   * @param {'success' | 'error'} type - The type of notification (default: 'success').
   */
  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  /**
   * Fetches the user's tasks from the API.
   */
  async function loadTasks() {
    setLoading(true)
    try { 
      setTasks(await getTasks()) 
    } catch { 
      showToast('Failed to load tasks', 'error') 
    }
    setLoading(false)
  }

  /**
   * Creates a new task and updates the local state.
   */
  async function handleAddTask(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>) {
    try { 
      const t = await createTask(task)
      setTasks(p => [t, ...p])
      showToast('Task added') 
    } catch { 
      showToast('Failed to add task', 'error') 
    }
  }

  /**
   * Updates an existing task and reflects changes locally.
   */
  async function handleUpdateTask(id: string, updates: Partial<Task>) {
    try { 
      const u = await updateTask(id, updates)
      setTasks(p => p.map(t => t.id === id ? u : t))
      showToast('Saved') 
    } catch { 
      showToast('Failed to update', 'error') 
    }
  }

  /**
   * Deletes a task by ID.
   */
  async function handleDeleteTask(id: string) {
    try { 
      await deleteTask(id)
      setTasks(p => p.filter(t => t.id !== id))
      showToast('Deleted') 
    } catch { 
      showToast('Failed to delete', 'error') 
    }
  }

  /**
   * Triggers the AI optimization process for the current task list.
   */
  async function handleOptimize() {
    if (!tasks.length) { 
      showToast('Add some tasks first', 'error')
      return 
    }
    setOpt(true)
    try { 
      setAiPlan(await optimizeDay(tasks))
      showToast('Plan ready') 
    } catch { 
      showToast('Optimization failed', 'error') 
    }
    setOpt(false)
  }

  /**
   * Applies the AI-generated plan:
   * 1. Reorders tasks based on the AI's priority list.
   * 2. Assigns the AI plan metadata to the relevant tasks.
   * 3. Persists changes to the backend.
   */
  async function handleAcceptPlan() {
    if (!aiPlan || !tasks.length) return
    try {
      const plannedIds = new Set(aiPlan.ordered_task_ids)
      
      // Reconstruct the task list: Planned tasks first, then others
      const reordered = [
        ...aiPlan.ordered_task_ids.map(id => tasks.find(t => t.id === id)).filter(Boolean),
        ...tasks.filter(t => !plannedIds.has(t.id))
      ] as Task[]

      // Update all tasks in parallel
      await Promise.all(
        reordered.map((t, i) => updateTask(t.id, {
          sort_order: i,
          ...(plannedIds.has(t.id) ? { ai_plan: aiPlan } : {})
        }))
      )

      // Update local state
      setTasks(reordered.map((t, i) => ({
        ...t,
        sort_order: i,
        ...(plannedIds.has(t.id) ? { ai_plan: aiPlan } : {})
      })))

      showToast('Plan applied!')
      setAiPlan(null)
    } catch { 
      showToast('Failed to save plan', 'error') 
    }
  }

  /**
   * Signs the user out and clears the session.
   */
  async function handleSignOut() {
    await supabase.auth.signOut()
    showToast('Signed out')
  }

  // ── Statistics Calculation ──────────────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const activeTasks = tasks.filter(t => !t.completed)
  
  // Filter tasks due today
  const todayActiveTasks = activeTasks.filter(t => {
    if (!t.deadline) return false
    const d = new Date(t.deadline)
    return d.getFullYear() === today.getFullYear() &&
           d.getMonth()    === today.getMonth() &&
           d.getDate()     === today.getDate()
  })
  
  const todayMinutes = todayActiveTasks.reduce((s, t) => s + t.estimate_minutes, 0)
  const todayHours   = (todayMinutes / 60).toFixed(1)

  // ── View Filtering ──────────────────────────────────────────────────────────────
  const filteredTasks = tasks.filter(t => {
    if (view === 'past') {
      // Past view: Completed tasks OR overdue tasks from previous days
      if (t.completed) return true
      if (!t.deadline) return false
      const d = new Date(t.deadline)
      d.setHours(0, 0, 0, 0)
      return d < today
    } else {
      // Today view: Active tasks due today or in the future (or no deadline)
      if (t.completed) return false
      if (!t.deadline) return true
      const d = new Date(t.deadline)
      d.setHours(0, 0, 0, 0)
      return d >= today
    }
  })

  const pastCompleted  = filteredTasks.filter(t => t.completed).length
  const pastIncomplete = filteredTasks.filter(t => !t.completed).length

  // ── Render Loading State ────────────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-2)', fontSize: 13 }}>Loading...</span>
      </div>
    )
  }

  // ── Render Auth Screen ──────────────────────────────────────────────────────────
  if (!session) return <Auth />

  // ── Render Main App ─────────────────────────────────────────────────────────────
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
          padding: '0 24px', height: 62,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: 'var(--accent)', flexShrink: 0
            }}>✦</div>
            <span className="header-logo-text" style={{
              fontSize: 15, fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.02em'
            }}>
              Focus Planner
            </span>
          </div>

          {/* Right side controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>

            {/* Stats Pill (Hidden on mobile < 680px) */}
            <div className="header-stats" style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, overflow: 'hidden', flexShrink: 0
            }}>
              <div style={{
                padding: '0 13px', height: 34,
                display: 'flex', alignItems: 'center', gap: 5,
                borderRight: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {todayActiveTasks.length}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>today</span>
              </div>
              <div style={{ padding: '0 13px', height: 34, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {todayHours}h
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>scheduled</span>
              </div>
            </div>

            {/* Theme Toggle (Hidden on mobile < 560px) */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="header-theme-btn"
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, transition: 'all 0.15s', flexShrink: 0
              }}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User Profile Menu */}
            <ProfileMenu session={session} tasks={tasks} onSignOut={handleSignOut} />

            {/* Divider (Hidden on mobile < 560px) */}
            <div className="header-divider" style={{
              width: 1, height: 20,
              background: 'var(--border)', flexShrink: 0
            }} />

            {/* AI Optimize Button */}
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 14px', height: 34, fontSize: 13,
                flexShrink: 0
              }}
            >
              {optimizing ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 12 }}>◌</span>
                  <span className="btn-optimize-text">Thinking...</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12 }}>✦</span>
                  <span className="btn-optimize-text">Optimize my day</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 24px' }}>

        {/* View Tabs */}
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

          {/* Left Column: Task Form or Past Summary */}
          <div className="form-sticky" style={{
            display: 'flex', flexDirection: 'column', gap: 14,
            position: 'sticky', top: 78
          }}>
            {view === 'today' && (
              <TaskForm onTaskAdded={handleAddTask} />
            )}

            {view === 'past' && (
              <div className="card" style={{ padding: '20px 24px' }}>
                <p style={{
                  fontSize: 11, color: 'var(--text-2)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16
                }}>
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

          {/* Right Column: Task List & AI Plan */}
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

      {/* ── Toast Notification ── */}
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