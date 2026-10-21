import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders the accessible message and handles its action', async () => {
    const onCreate = vi.fn()
    render(
      <EmptyState
        icon={FileText}
        title="Nothing here yet"
        description="Create your first item to get started."
        action={<button onClick={onCreate}>Create item</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument()
    expect(screen.getByText('Create your first item to get started.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create item' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })
})
