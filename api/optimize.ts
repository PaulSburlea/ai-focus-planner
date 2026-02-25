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

export function safeParseJson(text: string) {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

export function buildPrompt(tasks: TaskInput[]) {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  // Round up to next 15-minute mark so slots look clean (e.g. 13:41 → 13:45)
  const minutes = now.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15
  now.setMinutes(roundedMinutes, 0, 0)
  const currentTimeStr = now.toTimeString().slice(0, 5) // "13:45"

  const taskList = tasks.map(t => ({
    id: t.id,
    title: t.title,
    estimate: t.estimate_minutes,
    deadline: t.deadline || null,
  }))

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Validate body
  const { tasks } = req.body
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'No tasks provided' })
  }

  const invalidTask = (tasks as TaskInput[]).find(
    t => !t.id || !t.title || !t.estimate_minutes || t.estimate_minutes < 1
  )
  if (invalidTask) {
    return res.status(400).json({ error: 'Invalid task data' })
  }

  try {
    const { system, user: userPrompt } = buildPrompt(tasks as TaskInput[])

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