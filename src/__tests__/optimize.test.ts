import { describe, it, expect, vi, beforeEach } from 'vitest'
import { safeParseJson, buildPrompt } from '../../api/optimize'

// Mock OpenAI
vi.mock('openai', () => ({
  default: class {
    chat = {
      completions: {
        create: vi.fn()
      }
    }
  }
}))

describe('API: optimize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('safeParseJson', () => {
    it('should parse valid JSON', () => {
      const result = safeParseJson('{"test": "value"}')
      expect(result).toEqual({ test: 'value' })
    })

    it('should handle markdown code blocks', () => {
      const result = safeParseJson('```json\n{"test": "value"}\n```')
      expect(result).toEqual({ test: 'value' })
    })

    it('should handle markdown without json identifier', () => {
      const result = safeParseJson('```\n{"test": "value"}\n```')
      expect(result).toEqual({ test: 'value' })
    })

    it('should return null for invalid JSON', () => {
      expect(safeParseJson('invalid')).toBeNull()
      expect(safeParseJson('{test:}')).toBeNull()
    })

    it('should handle whitespace', () => {
      const result = safeParseJson('  {"test": "value"}  ')
      expect(result).toEqual({ test: 'value' })
    })
  })

  describe('buildPrompt', () => {
    it('should build system prompt with correct schema', () => {
      const tasks = [
        { id: '1', title: 'Test task', estimate_minutes: 30, deadline: null }
      ]
      const { system, user } = buildPrompt(tasks)

      expect(system).toContain('JSON')
      expect(system).toContain('ordered_task_ids')
      expect(system).toContain('slots')
      expect(system).toContain('rationale')
      expect(system).toContain('09:00 to 18:00')
    })

    it('should include task data in user prompt', () => {
      const tasks = [
        { id: '1', title: 'Task 1', estimate_minutes: 30, deadline: null },
        { id: '2', title: 'Task 2', estimate_minutes: 60, deadline: '2026-02-25T14:00:00' }
      ]
      const { user } = buildPrompt(tasks)

      const parsed = JSON.parse(user)
      expect(parsed.tasks).toHaveLength(2)
      expect(parsed.tasks[0].title).toBe('Task 1')
      expect(parsed.tasks[0].estimate).toBe(30)
      expect(parsed.tasks[1].deadline).toBe('2026-02-25T14:00:00')
    })

    it('should include current date in user prompt', () => {
      const tasks = []
      const { user } = buildPrompt(tasks)

      const parsed = JSON.parse(user)
      expect(parsed.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should handle tasks without deadlines', () => {
      const tasks = [
        { id: '1', title: 'No deadline', estimate_minutes: 45, deadline: null }
      ]
      const { user } = buildPrompt(tasks)

      const parsed = JSON.parse(user)
      expect(parsed.tasks[0].deadline).toBeNull()
    })
  })
})

describe('API response schema', () => {
  it('should require ordered_task_ids array', () => {
    const response = {
      ordered_task_ids: ['task1', 'task2'],
      slots: [],
      rationale: 'Test rationale'
    }
    expect(Array.isArray(response.ordered_task_ids)).toBe(true)
    expect(response.ordered_task_ids.length).toBeGreaterThan(0)
  })

  it('should require slots array with taskId, start, end', () => {
    const slot = {
      taskId: 'task1',
      start: '2026-02-25T09:00:00',
      end: '2026-02-25T10:00:00'
    }
    expect(slot).toHaveProperty('taskId')
    expect(slot).toHaveProperty('start')
    expect(slot).toHaveProperty('end')
    expect(slot.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(slot.end).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('should require rationale string', () => {
    const response = {
      ordered_task_ids: [],
      slots: [],
      rationale: 'This is the explanation'
    }
    expect(typeof response.rationale).toBe('string')
    expect(response.rationale.length).toBeGreaterThan(0)
  })
})
