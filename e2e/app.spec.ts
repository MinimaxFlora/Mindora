import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const E2E_PASSWORD = 'e2e-password-123'
let accountCounter = 0
let currentAccountEmail = ''

const desktopOnly = (name: string) =>
  test.skip(name.includes('mobile'), 'Desktop-only workflow')

const mobileOnly = (name: string) =>
  test.skip(!name.includes('mobile'), 'Mobile-only workflow')

async function registerAccount(page: Page, testInfo: { project: { name: string } }) {
  accountCounter += 1
  const email = `${testInfo.project.name}-${accountCounter}-${Date.now()}@e2e.mindora.test`
  currentAccountEmail = email
  await page.goto('/notes')
  await expect(page.getByRole('button', { name: 'Create account' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Create account' }).first().click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
  await page.getByLabel('Confirm password').fill(E2E_PASSWORD)
  await page.locator('form').getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByTestId('note-row').first()).toBeVisible({ timeout: 30_000 })
  return email
}

async function waitForSaved(page: Page) {
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 15_000 })
}

async function fillEditor(page: Page, content: string) {
  const editor = page.locator('.cm-content')
  await editor.click()
  await page.keyboard.insertText(content)
}

async function createFreshNote(page: Page) {
  const previousUrl = page.url()
  await page.getByTestId('sidebar-new-note').click()
  await expect(page).not.toHaveURL(previousUrl)
  await expect(page.getByLabel('Note title')).toHaveValue('Untitled note')
}

test.beforeEach(async ({ page }, testInfo) => {
  await registerAccount(page, testInfo)
})

test.describe('core note workflow', () => {
  test('creates a note, autosaves it, and restores it after reload', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)

    await page.getByLabel('Note title').fill('E2E autosave note')
    await fillEditor(page, '# Hello from Playwright\n\nThis body survives a reload.')
    await waitForSaved(page)

    await page.reload()
    await expect(page.getByLabel('Note title')).toHaveValue('E2E autosave note')
    await expect(page.locator('[data-testid="markdown-preview"]')).toContainText(
      'This body survives a reload.',
    )
  })

  test('renders Markdown features and sanitizes dangerous HTML', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Markdown and security')

    const markdown = `# Rendered heading

A table:

| Feature | Status |
| --- | --- |
| Math | Yes |

\`\`\`ts
const answer: number = 42
\`\`\`

Inline $a^2 + b^2 = c^2$.

\`\`\`mermaid
flowchart LR
  A[Idea] --> B[Note]
\`\`\`

Footnote.[^1]

[^1]: A helpful footnote.

<script>window.__mindoraXss = true</script>
<img src="x" onerror="window.__mindoraXss = true">
[bad link](javascript:alert(1))
`
    await fillEditor(page, markdown)
    await waitForSaved(page)
    await page.getByTestId('view-mode-read').click()

    const preview = page.locator('[data-testid="markdown-preview"]')
    await expect(preview).toContainText('Rendered heading')
    await expect(preview.locator('table')).toBeVisible()
    await expect(preview.locator('.katex').first()).toBeVisible()
    await expect(preview.locator('.shiki')).toBeVisible({ timeout: 20_000 })
    await expect(preview.locator('.mermaid-figure svg')).toBeVisible({ timeout: 20_000 })
    await expect(preview).toContainText('A helpful footnote.')

    expect(await page.locator('[data-testid="markdown-preview"] script').count()).toBe(0)
    expect(await page.locator('[data-testid="markdown-preview"] a[href^="javascript"]').count()).toBe(0)
    expect(await page.evaluate(() => (window as unknown as { __mindoraXss?: boolean }).__mindoraXss)).toBeUndefined()

    await page.getByTestId('view-mode-source').click()
    await expect(page.locator('.cm-content')).toContainText('Rendered heading')
  })

  test('supports wiki links, backlinks, search, trash, and restore', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Alpha E2E')
    await fillEditor(page, 'Alpha links to [[Beta E2E]] and stores searchable content.')
    await waitForSaved(page)

    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Beta E2E')
    await fillEditor(page, 'Beta body contains the unique phrase cosmic-otter.')
    await waitForSaved(page)

    await page.getByRole('link', { name: 'All notes' }).click()
    await page.getByTestId('note-row').filter({ hasText: 'Alpha E2E' }).first().click()
    await expect(page.getByLabel('Note title')).toHaveValue('Alpha E2E')
    const wikiLink = page.getByRole('link', { name: 'Open note: Beta E2E' })
    await expect(wikiLink).toBeVisible()
    await wikiLink.click()
    await expect(page.getByLabel('Note title')).toHaveValue('Beta E2E')

    await page.getByRole('button', { name: 'Outline and note relations' }).click()
    const inspector = page.getByRole('complementary', { name: 'Note relations' })
    await expect(inspector).toBeVisible()
    await inspector.getByRole('tab', { name: 'Relations' }).click()
    await expect(inspector.getByText('Alpha E2E')).toBeVisible()
    await page.getByRole('button', { name: 'Close relation panel' }).click()

    await page.keyboard.press('Control+k')
    const palette = page.getByRole('dialog')
    await palette.getByRole('textbox', { name: 'Search notes' }).fill('cosmic-otter')
    await expect(palette.getByRole('option').filter({ hasText: 'Beta E2E' })).toBeVisible()
    await palette.getByRole('option').filter({ hasText: 'Beta E2E' }).click()
    await expect(page.getByLabel('Note title')).toHaveValue('Beta E2E')

    await page.getByRole('button', { name: 'More note actions' }).click()
    await page.getByRole('menuitem', { name: 'Move to trash' }).click()
    const confirm = page.getByRole('dialog')
    await expect(confirm.getByText('Move to trash?')).toBeVisible()
    await confirm.getByRole('button', { name: 'Move to trash' }).click()
    await expect(page).toHaveURL(/\/notes$/)

    await page.getByRole('link', { name: 'Trash' }).click()
    const trashRow = page.getByTestId('note-row').filter({ hasText: 'Beta E2E' }).first()
    await expect(trashRow).toBeVisible()
    await trashRow.getByRole('button').first().click()
    await page.getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByLabel('Note title')).toHaveValue('Beta E2E')
    await expect(page).toHaveURL(/\/notes\/.+/)
  })

  test('switches interface language and persists the choice', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.getByTestId('language-menu').click()
    await page.getByRole('menuitem', { name: '繁體中文' }).click()
    await expect(page.getByRole('link', { name: '所有筆記' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant')
    await page.waitForTimeout(500)

    await page.reload()
    await expect(page.getByRole('link', { name: '所有筆記' })).toBeVisible()
    await expect(page.getByText('讓想法彼此相連')).toBeVisible()

    await page.goto('/settings')
    await page.getByTestId('locale-en').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })

  test('organizes with tags, folders, favorites, themes, and the graph', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Organized E2E')
    await fillEditor(page, '# Organized\n\nA note for folders, tags, and the graph.')
    await waitForSaved(page)

    const tagInput = page.getByRole('combobox', { name: 'Add tag' })
    await tagInput.fill('e2e-tag')
    await tagInput.press('Enter')
    await expect(page.getByRole('button', { name: 'Remove tag e2e-tag' })).toBeVisible()

    await page.getByRole('button', { name: 'New folder' }).click()
    const folderDialog = page.getByRole('dialog')
    await folderDialog.getByRole('textbox').fill('E2E folder')
    await folderDialog.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('link', { name: 'E2E folder' })).toBeVisible()

    await page.getByRole('button', { name: 'Favorite note' }).click()
    await expect(page.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.getByRole('button', { name: /^Dark/ }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.waitForTimeout(500)
    await page.reload()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.getByRole('link', { name: 'Knowledge graph' }).click()
    await expect(page.getByTestId('knowledge-graph')).toBeVisible()
    const node = page.getByRole('button', { name: /Organized E2E/ })
    await expect(node).toBeVisible()
    await node.press('Enter')
    await expect(page.getByLabel('Note title')).toHaveValue('Organized E2E')
  })

  test('uploads an image to Cloudflare and renders it in the preview', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Cloud image E2E')
    await fillEditor(page, '# Image\n\nA cloud attachment follows.')

    const uploadPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/attachments') && response.request().method() === 'POST',
    )
    await page.locator('input[type="file"]').setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    expect((await uploadPromise).status()).toBe(201)
    await expect(page.locator('[data-testid="markdown-preview"] img')).toHaveJSProperty(
      'naturalWidth',
      1,
    )
    await waitForSaved(page)
  })

  test('deletes the account and its cloud data', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Delete account' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Delete your account permanently?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Delete account' }).click()
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 15_000 })

    await page.getByLabel('Email').fill(currentAccountEmail)
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await page.locator('form').getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.')
  })

  test('keeps notes in the Cloudflare account across browsers', async ({ page, browser }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await createFreshNote(page)
    await page.getByLabel('Note title').fill('Cross-device cloud note')
    await fillEditor(page, '# Online\n\nThis note must appear in a second browser after login.')
    await waitForSaved(page)
    await page.waitForTimeout(2_000)

    const secondContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: 'en-US',
    })
    const secondPage = await secondContext.newPage()
    await secondPage.goto('/notes')
    await secondPage.getByLabel('Email').fill(currentAccountEmail)
    await secondPage.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD)
    await secondPage.locator('form').getByRole('button', { name: 'Sign in' }).click()
    await expect(secondPage.getByTestId('note-row').first()).toBeVisible({ timeout: 30_000 })
    await expect(
      secondPage.getByTestId('note-row').filter({ hasText: 'Cross-device cloud note' }),
    ).toBeVisible()

    await secondPage.getByRole('link', { name: 'Settings' }).click()
    await secondPage.getByRole('button', { name: 'Sign out' }).click()
    await secondPage.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click()
    await expect(secondPage.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await secondContext.close()
  })

  test('exports a ZIP backup and imports a Markdown file', async ({ page }, testInfo) => {
    desktopOnly(testInfo.project.name)
    await page.goto('/settings')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export full backup' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^mindora-backup-\d{4}-\d{2}-\d{2}\.zip$/)
    const downloadPath = await download.path()
    expect(downloadPath).not.toBeNull()
    const archive = await readFile(downloadPath!)
    expect(archive.subarray(0, 2).toString()).toBe('PK')

    await page.getByRole('button', { name: 'Import notes or backup' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'imported-e2e.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from(
        '---\ntitle: Imported E2E\ntags: [imported, e2e]\n---\n\n# Imported E2E\n\nImported body.',
      ),
    })
    await dialog.getByRole('button', { name: 'Import notes' }).click()
    await expect(dialog.getByText('Imported 1 note')).toBeVisible()
    await dialog.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('link', { name: 'All notes' }).click()
    await expect(page.getByTestId('note-row').filter({ hasText: 'Imported E2E' })).toBeVisible()
  })
})

test.describe('mobile layout', () => {
  test('opens navigation, edits a note, and returns to the note list', async ({ page }, testInfo) => {
    mobileOnly(testInfo.project.name)
    await page.goto('/notes')
    await page.getByRole('button', { name: 'Open navigation' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('link', { name: 'All notes' })).toBeVisible()
    await drawer.getByRole('button', { name: 'Close navigation' }).click()

    const firstNote = page.getByTestId('note-row').first()
    await expect(firstNote).toBeVisible()
    await firstNote.getByRole('button').first().click()
    await expect(page.getByLabel('Note title')).toBeVisible()
    await expect(page.getByTestId('view-mode-split')).toHaveCount(0)
    await page.getByRole('button', { name: 'Back to note list' }).click()
    await expect(page.getByTestId('note-row').first()).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
