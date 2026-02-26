import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

interface TaskInput {
  id: string
  title: string
  estimate_minutes: number
  deadline: string | null
}

interface OptimizeRequest {
  tasks: TaskInput[]
  currentTime?: string
  timezoneOffset?: number
}

export function safeParseJson(text: string) {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

export function buildPrompt(tasks: TaskInput[], currentTime?: string, timezoneOffset?: number) {
  let userTimeMs: number

  if (currentTime) {
    const utcTime = new Date(currentTime).getTime()
    // timezoneOffset pentru Romania e -120 (UTC+2)
    // formula: utcTime - (offset * 60000) = utcTime + 7200000 = ora locala
    userTimeMs = timezoneOffset !== undefined
      ? utcTime - (timezoneOffset * 60 * 1000)
      : utcTime
  } else {
    userTimeMs = Date.now()
  }

  const now = new Date(userTimeMs)

  // Data locala
  const year  = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day   = String(now.getUTCDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`

  // Round up la urmatorul interval de 15 minute (ex: 13:41 → 13:45)
  // Fix: daca roundedMinutes = 60, incrementam ora
  const rawMinutes = now.getUTCMinutes()
  const roundedMinutes = Math.ceil(rawMinutes / 15) * 15

  if (roundedMinutes === 60) {
    now.setUTCHours(now.getUTCHours() + 1, 0, 0, 0)
  } else {
    now.setUTCMinutes(roundedMinutes, 0, 0)
  }

  const hours = now.getUTCHours().toString().padStart(2, '0')
  const mins  = now.getUTCMinutes().toString().padStart(2, '0')
  const currentTimeStr = `${hours}:${mins}`

const taskList = tasks.map(t => {
  let localDeadline = t.deadline

  // Convertește deadline din UTC la ora locală a userului
  if (t.deadline && timezoneOffset !== undefined) {
    const utcMs = new Date(t.deadline).getTime()
    const localMs = utcMs - (timezoneOffset * 60 * 1000)
    const localDate = new Date(localMs)
    // Format ISO fără timezone ca AI-ul să nu confunde
    const y  = localDate.getUTCFullYear()
    const mo = String(localDate.getUTCMonth() + 1).padStart(2, '0')
    const d  = String(localDate.getUTCDate()).padStart(2, '0')
    const h  = String(localDate.getUTCHours()).padStart(2, '0')
    const mi = String(localDate.getUTCMinutes()).padStart(2, '0')
    localDeadline = `${y}-${mo}-${d}T${h}:${mi}:00`
  }

  return {
    id: t.id,
    title: t.title,
    estimate: t.estimate_minutes,
    deadline: localDeadline || null,
  }
})

  return {
    system: `You are a productivity assistant that schedules tasks for a single user's workday.
You must respond ONLY with valid JSON — no explanation, no markdown, no extra text.
The JSON must exactly match this schema:
{
  "ordered_task_ids": ["id1", "id2"],
  "slots": [
    { "taskId": "id1", "start": "2026-02-25T09:00:00", "end": "2026-02-25T10:00:00" }
  ],
  "rationale": "One or two sentences explaining the priority logic."
}
Rules:
- Use ISO 8601 format for start/end times
- Working hours are 09:00 to 18:00 with a 30min lunch break at 13:00
- Current time is ${currentTimeStr}. Schedule tasks starting from now, never in the past
- If current time is past 18:00, return empty slots and mention in rationale that the workday is over
- Prioritize tasks with earlier deadlines
- Do not schedule overlapping slots
- Skip tasks that don't fit in remaining working hours and mention them in rationale`,
    user: JSON.stringify({ date: dateStr, current_time: currentTimeStr, tasks: taskList })
  }
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const now = new Date()

  const { data: rateLimit } = await supabase
    .from('rate_limits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (rateLimit) {
    if (new Date(rateLimit.reset_at) < now) {
      await supabase
        .from('rate_limits')
        .update({ count: 1, reset_at: new Date(Date.now() + 86400000).toISOString() })
        .eq('user_id', userId)
      return true
    }
    if (rateLimit.count >= 10) return false
    await supabase
      .from('rate_limits')
      .update({ count: rateLimit.count + 1 })
      .eq('user_id', userId)
    return true
  } else {
    await supabase
      .from('rate_limits')
      .insert({ user_id: userId, count: 1, reset_at: new Date(Date.now() + 86400000).toISOString() })
    return true
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 2. Authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)

  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 3. Rate Limiting
  const allowed = await checkRateLimit(user.id)
  if (!allowed) {
    return res.status(429).json({ error: 'Daily limit reached. Try again tomorrow.' })
  }

  // 4. Payload Validation
  const { tasks, currentTime, timezoneOffset } = req.body as OptimizeRequest
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'No tasks provided' })
  }

  const invalidTask = tasks.find(
    t => !t.id || !t.title || !t.estimate_minutes || t.estimate_minutes < 1
  )
  if (invalidTask) {
    return res.status(400).json({ error: 'Invalid task data' })
  }

  // 5. AI Optimization
  try {
    const { system, user: userPrompt } = buildPrompt(tasks, currentTime, timezoneOffset)

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: userPrompt },
      ],
    })

    const raw = completion.choices[0].message.content ?? ''

    if (process.env.NODE_ENV !== 'production') {
      console.log('[optimize] raw LLM output:', raw)
    }

    const parsed = safeParseJson(raw)

    if (!parsed?.ordered_task_ids || !parsed?.slots || !parsed?.rationale) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[optimize] invalid JSON from LLM:', raw)
      }
      return res.status(500).json({ error: 'Invalid response from AI. Please try again.' })
    }

    return res.status(200).json(parsed)

  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[optimize] error:', err)
    }
    return res.status(500).json({ error: 'AI optimization failed.' })
  }
}