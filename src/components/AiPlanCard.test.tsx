import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AiPlanCard from './AiPlanCard'
import type { AiPlan, Task } from '../types'

describe('AiPlanCard', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      title: 'Write documentation',
      estimate_minutes: 60,
      deadline: '2026-02-25T12:00:00',
      notes: 'Include API docs',
      ai_plan: null,
      created_at: '2026-02-24T10:00:00'
    },
    {
      id: 'task-2',
      title: 'Review PRs',
      estimate_minutes: 30,
      deadline: '2026-02-25T14:00:00',
      notes: null,
      ai_plan: null,
      created_at: '2026-02-24T10:00:00'
    }
  ]

  const mockPlan: AiPlan = {
    ordered_task_ids: ['task-1', 'task-2'],
    slots: [
      { taskId: 'task-1', start: '2026-02-25T09:00:00', end: '2026-02-25T10:00:00' },
      { taskId: 'task-2', start: '2026-02-25T10:00:00', end: '2026-02-25T10:30:00' }
    ],
    rationale: 'Starting with documentation as it has the earliest deadline. PR review fits well in the remaining time.'
  }

  it('should render the AI plan header', () => {
    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getByText('AI Plan')).toBeInTheDocument()
  })

  it('should display the rationale', () => {
    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getByText(/Starting with documentation/)).toBeInTheDocument()
  })

  it('should display schedule slots', () => {
    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    // Should show Schedule section
    expect(screen.getByText('Schedule')).toBeInTheDocument()

    // Should show time slots (getAllByText because time appears multiple times)
    const time09Matches = screen.getAllByText(/09:/)
    expect(time09Matches.length).toBeGreaterThan(0)

    const time10Matches = screen.getAllByText(/10:/)
    expect(time10Matches.length).toBeGreaterThan(0)

    // Check both task titles appear (getAllByText returns array)
    const writeDocsElements = screen.getAllByText('Write documentation')
    expect(writeDocsElements.length).toBeGreaterThan(0)

    const reviewPRsElements = screen.getAllByText('Review PRs')
    expect(reviewPRsElements.length).toBeGreaterThan(0)
  })

  it('should display priority order', () => {
    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    // Check for priority badges
    expect(screen.getByText(/1\./)).toBeInTheDocument()
    expect(screen.getByText(/2\./)).toBeInTheDocument()
  })

  it('should call onAccept when Accept button is clicked', async () => {
    const onAccept = vi.fn()
    const user = userEvent.setup()

    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    )

    const acceptButton = screen.getByText('Accept & Save')
    await user.click(acceptButton)

    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('should call onReject when Discard button is clicked', async () => {
    const onReject = vi.fn()
    const user = userEvent.setup()

    render(
      <AiPlanCard
        plan={mockPlan}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={onReject}
      />
    )

    const discardButton = screen.getByText('Discard')
    await user.click(discardButton)

    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('should handle plan without slots', () => {
    const planWithoutSlots: AiPlan = {
      ordered_task_ids: ['task-1'],
      slots: [],
      rationale: 'No slots available'
    }

    render(
      <AiPlanCard
        plan={planWithoutSlots}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    expect(screen.getByText('No slots available')).toBeInTheDocument()
  })

  it('should handle unknown task IDs gracefully', () => {
    const planWithUnknownId: AiPlan = {
      ordered_task_ids: ['unknown-task'],
      slots: [],
      rationale: 'Test'
    }

    render(
      <AiPlanCard
        plan={planWithUnknownId}
        tasks={mockTasks}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    )

    // Should display the task ID when title not found
    expect(screen.getByText('unknown-task')).toBeInTheDocument()
  })
})
