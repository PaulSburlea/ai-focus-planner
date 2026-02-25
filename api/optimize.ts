import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
  const dateStr = new Date().toISOString().split('T')[0]

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
- Prioritize tasks with earlier deadlines
- Do not schedule overlapping slots
- Skip tasks that don't fit in remaining working hours and mention them in rationale`,
    user: JSON.stringify({ date: dateStr, tasks: taskList })
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { tasks } = req.body
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'No tasks provided' })
  }

  try {
    const { system, user } = buildPrompt(tasks as TaskInput[])

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user },
      ],
    })

    const raw = completion.choices[0].message.content ?? ''
    console.log('[optimize] raw LLM output:', raw)

    const parsed = safeParseJson(raw)

    if (!parsed?.ordered_task_ids || !parsed?.slots || !parsed?.rationale) {
      console.error('[optimize] invalid JSON from LLM:', raw)
      return res.status(500).json({ error: 'Invalid response from AI. Please try again.' })
    }

    return res.status(200).json(parsed)

  } catch (err) {
    console.error('[optimize] error:', err)
    return res.status(500).json({ error: 'AI optimization failed.' })
  }
}