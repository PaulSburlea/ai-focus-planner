import OpenAI from 'openai'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Initialize external clients using environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

/**
 * Represents a task provided by the user for scheduling.
 * 
 * @interface TaskInput
 * @property {string} id - Unique identifier for the task.
 * @property {string} title - The name or description of the task.
 * @property {number} estimate_minutes - Estimated duration to complete the task in minutes.
 * @property {string | null} deadline - Optional ISO 8601 date string representing the task's deadline.
 */
interface TaskInput {
  id: string
  title: string
  estimate_minutes: number
  deadline: string | null
}

/**
 * Safely parses a JSON string, stripping any Markdown formatting often returned by LLMs.
 * LLMs frequently wrap JSON responses in markdown code blocks (e.g., ```json ... ```).
 * This function removes those wrappers to prevent `JSON.parse` from throwing an error.
 * 
 * @param {string} text - The raw string output from the LLM.
 * @returns {any | null} The parsed JSON object, or null if parsing fails.
 */
export function safeParseJson(text: string) {
  try {
    // Strip markdown code block syntax and trim whitespace
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

/**
 * Constructs the system and user prompts required for the OpenAI API.
 * Calculates the current time rounded to the next 15-minute interval to ensure clean scheduling slots.
 * 
 * @param {TaskInput[]} tasks - The list of tasks to be scheduled.
 * @returns {{ system: string, user: string }} An object containing the formatted system and user prompts.
 */
export function buildPrompt(tasks: TaskInput[]) {
  const now = new Date()
  const dateStr = now.toISOString().split('T')[0]

  // Round up to the next 15-minute mark so slots look clean and natural (e.g., 13:41 → 13:45).
  // This prevents the AI from generating overly specific, unrealistic start times.
  const minutes = now.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15
  now.setMinutes(roundedMinutes, 0, 0)
  const currentTimeStr = now.toTimeString().slice(0, 5) // Format: "HH:MM"

  // Map tasks to a simplified structure to reduce token usage in the prompt
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
  "slots":[
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

/**
 * Vercel Serverless Function handler for the AI task optimization endpoint.
 * Handles CORS, authenticates the user via Supabase, validates the task payload,
 * and communicates with OpenAI to generate an optimized daily schedule.
 * 
 * @param {VercelRequest} req - The incoming HTTP request.
 * @param {VercelResponse} res - The outgoing HTTP response.
 * @returns {Promise<VercelResponse>} A JSON response containing the optimized schedule or an error message.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS Configuration
  // Ensure the frontend can communicate with this serverless function across different origins.
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  // Handle preflight requests
  if (req.method === 'OPTIONS') return res.status(200).end()
  
  // Restrict endpoint to POST requests only
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // 2. Authentication
  // Extract the Bearer token and verify it against Supabase to ensure the user is authorized.
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // 3. Payload Validation
  const { tasks } = req.body
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'No tasks provided' })
  }

  // Ensure all tasks have the required fields and valid estimates
  const invalidTask = (tasks as TaskInput[]).find(
    t => !t.id || !t.title || !t.estimate_minutes || t.estimate_minutes < 1
  )
  if (invalidTask) {
    return res.status(400).json({ error: 'Invalid task data' })
  }

  // 4. AI Optimization
  try {
    const { system, user: userPrompt } = buildPrompt(tasks as TaskInput[])

    // Call OpenAI. Temperature is set low (0.3) to favor deterministic, structured JSON output 
    // over creative text generation.
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages:[
        { role: 'system', content: system },
        { role: 'user',   content: userPrompt },
      ],
    })

    const raw = completion.choices[0].message.content ?? ''

    // Log raw output in non-production environments for debugging purposes
    if (process.env.NODE_ENV !== 'production') {
      console.log('[optimize] raw LLM output:', raw)
    }

    const parsed = safeParseJson(raw)

    // Validate that the AI returned the exact JSON schema requested
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