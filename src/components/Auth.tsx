import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Mode = 'landing' | 'login' | 'register'

export default function Auth() {
  const [mode,     setMode]     = useState<Mode>('landing')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Account created! Check your email to confirm.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    })
    if (error) setError(error.message)
  }

  // ── Landing Page ──
  if (mode === 'landing') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Nav */}
        <nav style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '0 32px', height: 58,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--accent-dim)', border: '1px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, color: 'var(--accent)'
            }}>✦</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Focus Planner</span>
            <span style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 5, padding: '2px 7px' }}>AI</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('login')} className="btn-ghost" style={{ fontSize: 13 }}>Sign in</button>
            <button onClick={() => setMode('register')} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>Get started →</button>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px 40px', textAlign: 'center' }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            borderRadius: 20, padding: '5px 14px', marginBottom: 28,
            fontSize: 12, color: 'var(--accent)', fontWeight: 500
          }}>
            <span>✦</span> AI-powered task scheduling
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(32px, 6vw, 56px)',
            fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            maxWidth: 700, marginBottom: 20
          }}>
            Stop planning your day.<br />
            <span style={{ color: 'var(--accent)' }}>Let AI do it.</span>
          </h1>

          <p style={{
            fontSize: 17, color: 'var(--text-2)', maxWidth: 520,
            lineHeight: 1.7, marginBottom: 36
          }}>
            Add your tasks, set deadlines, and let AI organize your entire workday into an optimized schedule — in seconds.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => setMode('register')}
              className="btn-primary"
              style={{ fontSize: 15, padding: '13px 28px' }}
            >
              Start for free →
            </button>
            <button
              onClick={() => setMode('login')}
              className="btn-ghost"
              style={{ fontSize: 15, padding: '13px 28px' }}
            >
              Sign in
            </button>
          </div>

          {/* Social proof */}
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 20 }}>
            No credit card required · Free to use
          </p>

          {/* Features */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16, marginTop: 64, width: '100%', maxWidth: 780
          }}>
            {[
              {
                icon: '📋',
                title: 'Smart task management',
                desc: 'Create tasks with deadlines, duration estimates, and notes. Organized by day automatically.'
              },
              {
                icon: '✦',
                title: 'AI-powered scheduling',
                desc: 'One click to get an optimized daily schedule with exact time slots based on your priorities.'
              },
              {
                icon: '⏱',
                title: 'Time-block visualization',
                desc: 'See your day as concrete time blocks. Accept the AI plan and tasks reorder instantly.'
              },
            ].map((f, i) => (
              <div key={i} className="card" style={{ padding: '22px 24px', textAlign: 'left' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, marginBottom: 14
                }}>{f.icon}</div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{f.title}</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Built with */}
          <div style={{
            marginTop: 48, display: 'flex', alignItems: 'center', gap: 16,
            fontSize: 12, color: 'var(--text-3)', flexWrap: 'wrap', justifyContent: 'center'
          }}>
            <span>Built with</span>
            {['React', 'OpenAI', 'Supabase', 'Vercel'].map((t, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 6,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-2)', fontSize: 11,
                fontFamily: 'Fira Code, monospace'
              }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Auth Form ──
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Back */}
        <button
          onClick={() => { setMode('landing'); setError(null) }}
          style={{ fontSize: 13, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          ← Back
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--accent-dim)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: 'var(--accent)', margin: '0 auto 14px'
          }}>✦</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Focus Planner
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="field-label">Email</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={e => setEmail(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} className="input-field" minLength={6} required />
              {mode === 'register' && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Minimum 6 characters</p>
              )}
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: 'var(--danger-dim)', border: '1px solid var(--danger)', fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(22,163,74,0.1)', border: '1px solid #16a34a', fontSize: 13, color: '#16a34a' }}>
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', marginTop: 4 }}>
              {loading ? '...' : mode === 'login' ? 'Sign in →' : 'Create account →'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <button type="button" onClick={handleGoogle} className="btn-ghost"
            style={{ width: '100%', padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 13, fontWeight: 600 }}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-2)' }}>
            {mode === 'login' ? (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('register'); setError(null) }}
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(null) }}
                  style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}