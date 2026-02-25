/**
 * Represents a single task entity in the system.
 * Maps directly to the `tasks` table in the Supabase database.
 * 
 * @interface Task
 */
export interface Task {
  /** Unique UUID for the task. */
  id: string
  
  /** The UUID of the user who owns this task. */
  user_id: string
  
  /** The main description or name of the task. */
  title: string
  
  /** Estimated duration in minutes. */
  estimate_minutes: number
  
  /** Optional ISO 8601 date string representing the deadline. */
  deadline: string | null
  
  /** Optional additional details or context for the task. */
  notes: string | null
  
  /** 
   * The AI-generated scheduling plan associated with this task, if any.
   * This is stored as a JSONB column in the database.
   */
  ai_plan: AiPlan | null
  
  /** Whether the task has been marked as finished. */
  completed: boolean
  
  /** 
   * Numerical value used for ordering tasks in the UI. 
   * Can be manually set or determined by AI priority.
   */
  sort_order: number
  
  /** ISO 8601 string representing when the task was created. */
  created_at: string
}

/**
 * Represents a specific time block scheduled for a task.
 * 
 * @interface Slot
 */
export interface Slot {
  /** The ID of the task assigned to this slot. */
  taskId: string
  
  /** ISO 8601 string for the start time of the slot. */
  start: string
  
  /** ISO 8601 string for the end time of the slot. */
  end: string
}

/**
 * Represents the structure of the AI-generated optimization response.
 * 
 * @interface AiPlan
 */
export interface AiPlan {
  /** An array of task IDs sorted by calculated priority. */
  ordered_task_ids: string[]
  
  /** A list of specific time slots assigned to tasks. */
  slots: Slot[]
  
  /** A brief text explanation of the AI's scheduling logic. */
  rationale: string
}

/**
 * Represents a temporary UI notification state.
 * 
 * @interface Toast
 */
export interface Toast {
  /** The text message to display to the user. */
  message: string
  
  /** The visual style of the notification. */
  type: 'success' | 'error'
}

/**
 * Represents a simplified user entity derived from the authentication session.
 * 
 * @interface User
 */
export interface User {
  /** Unique UUID of the user. */
  id: string
  
  /** The user's email address. */
  email: string | undefined
}