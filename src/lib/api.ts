import { supabase } from './supabaseClient'
import type { Task, AiPlan } from '../types'

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTask(task: Omit<Task, 'id' | 'created_at' | 'ai_plan' | 'user_id'>): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...task, user_id: user?.id })
    .select()
    .single()
  if (error) throw error
  return data
}

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

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function optimizeDay(tasks: Task[]): Promise<AiPlan> {
  const res = await fetch('/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks })
  })
  if (!res.ok) throw new Error('Optimize failed')
  return res.json()
}