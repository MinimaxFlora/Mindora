import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SettingsProvider } from '@/providers/settings-provider'

import { TagEditor } from './tag-editor'

function renderEditor(tags: string[], onChange = vi.fn()) {
  render(
    <SettingsProvider>
      <TagEditor tags={tags} suggestions={['guide', 'markdown']} onChange={onChange} />
    </SettingsProvider>,
  )
  const input = screen.getByRole('combobox')
  return { input, onChange }
}

describe('TagEditor', () => {
  it('adds a normalized tag with Enter and avoids duplicates', async () => {
    const { input, onChange } = renderEditor(['guide'])
    const user = userEvent.setup()
    await user.type(input, '#New Tag{Enter}')
    expect(onChange).toHaveBeenCalledWith(['guide', 'New-Tag'])
  })

  it('removes a tag from its accessible chip button', async () => {
    const { onChange } = renderEditor(['alpha', 'beta'])
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button')[0]!)
    expect(onChange).toHaveBeenCalledWith(['beta'])
  })
})
