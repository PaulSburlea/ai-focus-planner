import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskForm from './TaskForm'

describe('TaskForm', () => {
  const mockOnTaskAdded = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock the async function to resolve immediately
    mockOnTaskAdded.mockResolvedValue(undefined)
  })

  it('should render form fields', () => {
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    expect(screen.getByPlaceholderText('e.g. Write project report')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Or type custom minutes')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
  })

  it('should show duration presets', () => {
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    expect(screen.getByText('15m')).toBeInTheDocument()
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('1h')).toBeInTheDocument()
    expect(screen.getByText('2h')).toBeInTheDocument()
  })

  it('should select preset when clicked', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const preset30m = screen.getByText('30m')
    await user.click(preset30m)

    // The input should now have value 30
    const input = screen.getByPlaceholderText('Or type custom minutes')
    expect(input).toHaveValue(30)
  })

  it('should show formatted duration for custom minutes', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const input = screen.getByPlaceholderText('Or type custom minutes')
    await user.type(input, '75')

    expect(screen.getByText('= 1h 15m')).toBeInTheDocument()
  })

  it('should toggle deadline section', async () => {
    const user = userEvent.setup()
    const { container } = render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    // Initially deadline section should be hidden
    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()

    const addButton = screen.getByText('+ Add deadline')
    await user.click(addButton)

    // Now deadline inputs should be visible
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument()
  })

  it('should remove deadline when Remove is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    // Add deadline first
    const addButton = screen.getByText('+ Add deadline')
    await user.click(addButton)

    // Verify date input is present
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument()

    // Now remove it
    const removeButton = screen.getByText('✕ Remove')
    await user.click(removeButton)

    expect(container.querySelector('input[type="date"]')).not.toBeInTheDocument()
  })

  it('should submit task with valid data', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const titleInput = screen.getByPlaceholderText('e.g. Write project report')
    await user.type(titleInput, 'Complete the feature')

    // Select 30m preset
    const preset30m = screen.getByText('30m')
    await user.click(preset30m)

    // Submit form
    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnTaskAdded).toHaveBeenCalled()
    })

    const callArgs = mockOnTaskAdded.mock.calls[0][0]
    expect(callArgs.title).toBe('Complete the feature')
    expect(callArgs.estimate_minutes).toBe(30)
    expect(callArgs.deadline).toBeNull()
  })

  it('should submit task with deadline', async () => {
    const user = userEvent.setup()
    const { container } = render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const titleInput = screen.getByPlaceholderText('e.g. Write project report')
    await user.type(titleInput, 'Urgent task')

    const preset1h = screen.getByText('1h')
    await user.click(preset1h)

    // Add deadline
    await user.click(screen.getByText('+ Add deadline'))

    const dateInput = container.querySelector('input[type="date"]')
    if (dateInput) {
      // Set date to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await user.type(dateInput, tomorrow.toISOString().split('T')[0])
    }

    // Submit
    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnTaskAdded).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('should submit task with notes', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const titleInput = screen.getByPlaceholderText('e.g. Write project report')
    await user.type(titleInput, 'Task with notes')

    const preset15m = screen.getByText('15m')
    await user.click(preset15m)

    const notesInput = screen.getByPlaceholderText('Context, links, sub-tasks...')
    await user.type(notesInput, 'Check the documentation for API details')

    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnTaskAdded).toHaveBeenCalled()
    }, { timeout: 3000 })

    const callArgs = mockOnTaskAdded.mock.calls[0][0]
    expect(callArgs.title).toBe('Task with notes')
    expect(callArgs.estimate_minutes).toBe(15)
    expect(callArgs.notes).toBe('Check the documentation for API details')
  })

  it('should not submit without title', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    // Don't enter title, just select duration
    const preset30m = screen.getByText('30m')
    await user.click(preset30m)

    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    expect(mockOnTaskAdded).not.toHaveBeenCalled()
  })

  it('should not submit without estimate', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const titleInput = screen.getByPlaceholderText('e.g. Write project report')
    await user.type(titleInput, 'Task without estimate')

    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    expect(mockOnTaskAdded).not.toHaveBeenCalled()
  })

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup()
    render(<TaskForm onTaskAdded={mockOnTaskAdded} />)

    const titleInput = screen.getByPlaceholderText('e.g. Write project report') as HTMLInputElement
    await user.type(titleInput, 'Test task')

    const preset30m = screen.getByText('30m')
    await user.click(preset30m)

    const submitButton = screen.getByText('Add task →')
    await user.click(submitButton)

    await waitFor(() => {
      expect(titleInput.value).toBe('')
    })
  })
})
