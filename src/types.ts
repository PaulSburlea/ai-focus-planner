export interface Task {
  id: string
  user_id: string
  title: string
  estimate_minutes: number
  deadline: string | null
  notes: string | null
  ai_plan: AiPlan | null
  completed: boolean
  created_at: string
}

export interface Slot {
  taskId: string
  start: string
  end: string
}

export interface AiPlan {
  ordered_task_ids: string[]
  slots: Slot[]
  rationale: string
}

export interface Toast {
  message: string
  type: 'success' | 'error'
}

export interface User {
  id: string
  email: string | undefined
}