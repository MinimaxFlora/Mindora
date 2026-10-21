import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { createNote } from '@/db/repository'
import { useI18n } from '@/i18n/use-i18n'
import { errorText } from '@/lib/errors'
import { parseScopePath } from '@/lib/paths'

export function useCreateNote() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()

  return React.useCallback(
    async (options?: { title?: string; content?: string; folderId?: string | null; tags?: string[] }) => {
      const { scope } = parseScopePath(location.pathname)
      const folderId =
        options?.folderId !== undefined
          ? options.folderId
          : scope.kind === 'folder'
            ? scope.folderId
            : null
      const tags = options?.tags ?? (scope.kind === 'tag' ? [scope.tag] : [])
      try {
        const note = await createNote({
          title: options?.title,
          content: options?.content ?? '',
          folderId,
          tags,
        })
        if (scope.kind === 'trash') {
          navigate(`/notes/${note.id}`, { state: { focusTitle: true } })
        } else {
          navigate(`${parseScopePath(location.pathname).basePath}/${note.id}`, {
            state: { focusTitle: true },
          })
        }
        return note
      } catch (error) {
        toast.error(t('editor.toast.createFailed'), {
          description: errorText(error, t, 'editor.toast.createFailedDesc'),
        })
        return null
      }
    },
    [location.pathname, navigate, t],
  )
}
