import { supabase } from './supabaseClient'
import type { Task, AiPlan } from '../types'

/**
 * Fetches all tasks for the authenticated user from Supabase.
 * 
 * The results are ordered by:
 * 1. `sort_order` (Ascending) - To respect manual or AI-generated priority.
 * 2. `created_at` (Descending) - To show newest tasks first within the same priority level.
 * 
 * @returns {Promise<Task[]>} A promise that resolves to the list of tasks.
 * @throws {Error} If the Supabase query fails.
 */
export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

/**
 * Creates a new task in the database.
 * 
 * Automatically retrieves the current authenticated user's ID to associate
 * the task with the correct account.
 * 
 * @param {Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>} task 
 *        The task data excluding system-generated fields.
 * @returns {Promise<Task>} The newly created task object.
 * @throws {Error} If the user is not authenticated or the insert fails.
 */
export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id' | 'sort_order'>): Promise<Task> {
  // Fetch current user to ensure row-level security (RLS) compliance
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: user?.id })
    .select()
    .single()
  
  if (error) throw error
  return data
}

/**
 * Updates specific fields of an existing task.
 * 
 * @param {string} id - The unique UUID of the task to update.
 * @param {Partial<Task>} updates - An object containing only the fields to be updated.
 * @returns {Promise<Task>} The updated task object.
 * @throws {Error} If the update operation fails.
 */
export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return data
}

/**
 * Deletes a task from the database permanently.
 * 
 * @param {string} id - The unique UUID of the task to delete.
 * @returns {Promise<void>}
 * @throws {Error} If the delete operation fails.
 */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
  
  if (error) throw error
}

/**
 * Sends the current list of tasks to the serverless AI endpoint for optimization.
 * 
 * This function retrieves the current session token to authenticate the request
 * against the backend API (which verifies the user via Supabase Auth).
 * 
 * @param {Task[]} tasks - The list of tasks to be scheduled and prioritized.
 * @returns {Promise<AiPlan>} The AI-generated schedule and rationale.
 * @throws {Error} If the API request fails or returns a non-200 status.
 */
export async function optimizeDay(tasks: Task[]): Promise<AiPlan> {
  // Retrieve the active session to get the access token for the API request
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch('/api/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Pass the Supabase JWT to the serverless function for verification
      'Authorization': `Bearer ${session?.access_token ?? ''}`
    },
    body: JSON.stringify({ tasks })
  })

  if (!res.ok) throw new Error('Optimize failed')
  return res.json()
}