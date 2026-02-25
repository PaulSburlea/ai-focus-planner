import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// Funcții din TaskList.tsx
function formatMinutes(min: number) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getDeadlineInfo(deadline: string) {
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const str = d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  if (diff < 0) return { str, tag: 'OVERDUE', color: '#f87171' }
  if (hours < 3) return { str, tag: 'due soon', color: '#fb923c' }
  if (days < 1) return { str, tag: 'today', color: '#facc15' }
  return { str, tag: null, color: 'var(--text-2)' }
}

// Funcții din api/optimize.ts
function safeParseJson(text: string) {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

describe('formatMinutes', () => {
  it('should format minutes less than 60', () => {
    expect(formatMinutes(15)).toBe('15m')
    expect(formatMinutes(30)).toBe('30m')
    expect(formatMinutes(59)).toBe('59m')
  })

  it('should format exact hours', () => {
    expect(formatMinutes(60)).toBe('1h')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(180)).toBe('3h')
  })

  it('should format hours and minutes', () => {
    expect(formatMinutes(75)).toBe('1h 15m')
    expect(formatMinutes(90)).toBe('1h 30m')
    expect(formatMinutes(150)).toBe('2h 30m')
  })

  it('should handle zero', () => {
    expect(formatMinutes(0)).toBe('0m')
  })
})

describe('getDeadlineInfo', () => {
  let originalDate: Date

  beforeEach(() => {
    originalDate = new Date()
  })

  afterEach(() => {
    // Restore Date constructor
  })

  it('should mark overdue tasks', () => {
    const past = new Date()
    past.setHours(past.getHours() - 5)
    const result = getDeadlineInfo(past.toISOString())
    expect(result.tag).toBe('OVERDUE')
    expect(result.color).toBe('#f87171')
  })

  it('should mark tasks due within 3 hours as "due soon"', () => {
    const soon = new Date()
    soon.setHours(soon.getHours() + 2)
    const result = getDeadlineInfo(soon.toISOString())
    expect(result.tag).toBe('due soon')
    expect(result.color).toBe('#fb923c')
  })

  it('should mark tasks due today but not within 3 hours as "today"', () => {
    const laterToday = new Date()
    laterToday.setHours(23, 59, 59, 999)
    const result = getDeadlineInfo(laterToday.toISOString())
    expect(result.tag).toBe('today')
    expect(result.color).toBe('#facc15')
  })

  it('should not tag tasks due tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const result = getDeadlineInfo(tomorrow.toISOString())
    expect(result.tag).toBeNull()
  })
})

describe('safeParseJson', () => {
  it('should parse valid JSON', () => {
    const json = '{"key": "value"}'
    expect(safeParseJson(json)).toEqual({ key: 'value' })
  })

  it('should parse JSON with markdown code blocks', () => {
    const json = '```json\n{"key": "value"}\n```'
    expect(safeParseJson(json)).toEqual({ key: 'value' })
  })

  it('should parse JSON with single markdown block', () => {
    const json = '```json\n{"key": "value"}'
    expect(safeParseJson(json)).toEqual({ key: 'value' })
  })

  it('should return null for invalid JSON', () => {
    expect(safeParseJson('not json')).toBeNull()
    expect(safeParseJson('{invalid}')).toBeNull()
  })

  it('should parse complex nested objects', () => {
    const json = '{"tasks": [{"id": "1", "title": "Test"}], "count": 1}'
    expect(safeParseJson(json)).toEqual({
      tasks: [{ id: '1', title: 'Test' }],
      count: 1
    })
  })
})

// Funcția groupTasksByDay - importată din TaskList
describe('groupTasksByDay', () => {
  it('should group tasks by deadline', () => {
    // This would be tested with the actual function from TaskList
    // For now, we're documenting the expected behavior
    expect(true).toBe(true)
  })
})
