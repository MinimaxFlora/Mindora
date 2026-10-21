import { Compass } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/use-i18n'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  return (
    <div className="flex h-full items-center justify-center px-6">
      <EmptyState
        icon={Compass}
        title={t('notes.notFound.title')}
        description={t('notes.notFound.description')}
        action={<Button onClick={() => navigate('/notes')}>{t('notes.notFound.back')}</Button>}
        secondaryAction={
          <Button variant="secondary" onClick={() => navigate('/search')}>
            {t('common.search')}
          </Button>
        }
      />
    </div>
  )
}
