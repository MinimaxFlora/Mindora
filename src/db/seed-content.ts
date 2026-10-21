import type { Locale } from '@/lib/locale'

export interface SeedContent {
  folderName: string
  welcomeTitle: string
  guideTitle: string
  welcomeTags: string[]
  guideTags: string[]
  guideAliases: string[]
  welcomeContent: string
  guideContent: string
}

const zhCN: SeedContent = {
  folderName: '开始使用',
  welcomeTitle: '欢迎来到 Mindora',
  guideTitle: 'Markdown 语法示例',
  welcomeTags: ['指南', '开始'],
  guideTags: ['Markdown', '指南'],
  guideAliases: ['语法示例'],
  welcomeContent: `# 欢迎来到 Mindora

Mindora 是一间安静、可靠的写作空间。它把 **Markdown 源文**、精致的阅读视图和知识关联放在同一处，并把你的笔记同步保存到 Cloudflare 账户。

> 登录后，笔记会保存到 Cloudflare D1，并在当前浏览器保留缓存。换一台设备登录，仍能继续写作。

## 从这里开始

- 点击左上角的 **新建笔记**，或按 \`Alt + N\`。
- 按 \`Ctrl / ⌘ + K\` 随时搜索全部笔记。
- 在源码、阅读和分屏三种模式之间切换。
- 用标签、文件夹和收藏整理内容。
- 用 \`[[Markdown 语法示例]]\` 这样的双向链接连接想法。

## 为什么是 Markdown

你的文字应当比任何一个应用活得更久。Mindora 始终保留原始 Markdown，并支持导出单篇笔记或完整备份。

## 试一试

1. 修改这篇笔记的任意内容。
2. 等待右上角显示「已保存」。
3. 刷新页面，确认内容仍然存在。
4. 打开 [[Markdown 语法示例]]，查看代码、公式、图表和表格。

> 提示：所有笔记都可以从「设置 → 数据管理」导出为 ZIP 备份。
`,
  guideContent: `---
title: Markdown 语法示例
tags:
  - Markdown
  - 指南
---

# Markdown 语法示例

这是一篇可随时修改的语法速查笔记。回到 [[欢迎来到 Mindora]] 查看云端同步与工作流。

## 文本与列表

**粗体**、*斜体*、~~删除线~~、\`行内代码\`，以及[外部链接](https://commonmark.org/help/)。

- 无序列表
  - 支持嵌套
- 任务清单：
  - [x] 创建第一篇笔记
  - [ ] 建立自己的标签体系
  - [ ] 导入旧笔记

### 代码

\`\`\`ts
type Note = {
  id: string
  title: string
  tags: string[]
}

export function describe(note: Note): string {
  return \`\${note.title} · \${note.tags.join(', ')}\`
}
\`\`\`

### 表格

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 自动保存 | 已支持 | 写入缓存并同步到云端 |
| 双向链接 | 已支持 | 支持别名与反向链接 |
| 导出 | 已支持 | Markdown / ZIP |

### 数学公式

行内公式：$E = mc^2$。

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### Mermaid 图表

\`\`\`mermaid
flowchart LR
  A[捕捉想法] --> B[Markdown 笔记]
  B --> C[双向链接]
  C --> D[知识图谱]
\`\`\`

### 引用与脚注

> 好的工具应当让思考变得更容易，而不是让整理工具本身成为工作。[^1]

[^1]: 这是一条脚注。
`,
}

const zhTW: SeedContent = {
  folderName: '開始使用',
  welcomeTitle: '歡迎來到 Mindora',
  guideTitle: 'Markdown 語法範例',
  welcomeTags: ['指南', '開始'],
  guideTags: ['Markdown', '指南'],
  guideAliases: ['語法範例'],
  welcomeContent: `# 歡迎來到 Mindora

Mindora 是一間安靜、可靠的寫作空間。它把 **Markdown 原始碼**、精緻的閱讀檢視和知識關聯放在同一處，並把你的筆記同步保存到 Cloudflare 帳戶。

> 登入後，筆記會保存到 Cloudflare D1，並在目前瀏覽器保留快取。換一台裝置登入，仍能繼續寫作。

## 從這裡開始

- 點擊左上角的 **新增筆記**，或按 \`Alt + N\`。
- 按 \`Ctrl / ⌘ + K\` 隨時搜尋所有筆記。
- 在原始碼、閱讀和分割三種模式之間切換。
- 用標籤、資料夾和收藏整理內容。
- 用 \`[[Markdown 語法範例]]\` 這樣的雙向連結串連想法。

## 為什麼是 Markdown

你的文字應當比任何一個應用程式活得更久。Mindora 始終保留原始 Markdown，並支援匯出單篇筆記或完整備份。

## 試一試

1. 修改這篇筆記的任意內容。
2. 等待右上角顯示「已儲存」。
3. 重新整理頁面，確認內容仍然存在。
4. 開啟 [[Markdown 語法範例]]，查看程式碼、公式、圖表和表格。

> 提示：所有筆記都可以從「設定 → 資料管理」匯出為 ZIP 備份。
`,
  guideContent: `---
title: Markdown 語法範例
tags:
  - Markdown
  - 指南
---

# Markdown 語法範例

這是一篇可隨時修改的語法速查筆記。回到 [[歡迎來到 Mindora]] 查看雲端同步與工作流。

## 文字與列表

**粗體**、*斜體*、~~刪除線~~、\`行內程式碼\`，以及[外部連結](https://commonmark.org/help/)。

- 無序列表
  - 支援巢狀
- 任務清單：
  - [x] 建立第一篇筆記
  - [ ] 建立自己的標籤體系
  - [ ] 匯入舊筆記

### 程式碼

\`\`\`ts
type Note = {
  id: string
  title: string
  tags: string[]
}

export function describe(note: Note): string {
  return \`\${note.title} · \${note.tags.join(', ')}\`
}
\`\`\`

### 表格

| 能力 | 狀態 | 說明 |
| --- | --- | --- |
| 自動儲存 | 已支援 | 寫入快取並同步到雲端 |
| 雙向連結 | 已支援 | 支援別名與反向連結 |
| 匯出 | 已支援 | Markdown / ZIP |

### 數學公式

行內公式：$E = mc^2$。

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### Mermaid 圖表

\`\`\`mermaid
flowchart LR
  A[捕捉想法] --> B[Markdown 筆記]
  B --> C[雙向連結]
  C --> D[知識圖譜]
\`\`\`

### 引用與註腳

> 好的工具應當讓思考變得更容易，而不是讓整理工具本身成為工作。[^1]

[^1]: 這是一條註腳。
`,
}

const en: SeedContent = {
  folderName: 'Getting started',
  welcomeTitle: 'Welcome to Mindora',
  guideTitle: 'Markdown syntax guide',
  welcomeTags: ['Guide', 'Getting started'],
  guideTags: ['Markdown', 'Guide'],
  guideAliases: ['Syntax guide'],
  welcomeContent: `# Welcome to Mindora

Mindora is a calm, dependable writing space. It keeps **Markdown source**, a refined reading view, and the connections between ideas in one place — and syncs your notes to your Cloudflare account.

> After signing in, notes are stored in Cloudflare D1 with a local browser cache. Sign in on another device and keep writing.

## Start here

- Click **New note** in the sidebar, or press \`Alt + N\`.
- Press \`Ctrl / ⌘ + K\` to search every note at any time.
- Switch between source, reading, and split views.
- Organize with tags, folders, and favorites.
- Connect ideas with wiki links such as \`[[Markdown syntax guide]]\`.

## Why Markdown

Your words should outlive any single app. Mindora always keeps the original Markdown and supports single-note export or a complete backup.

## Try it

1. Edit any part of this note.
2. Wait for “Saved” in the top right.
3. Refresh the page and confirm the content is still here.
4. Open [[Markdown syntax guide]] to explore code, math, diagrams, and tables.

> Tip: export every note as a ZIP backup from Settings → Data.
`,
  guideContent: `---
title: Markdown syntax guide
tags:
  - Markdown
  - Guide
---

# Markdown syntax guide

A quick reference you can edit at any time. Return to [[Welcome to Mindora]] to review cloud sync and the basic workflow.

## Text and lists

**Bold**, *italic*, ~~strikethrough~~, \`inline code\`, and an [external link](https://commonmark.org/help/).

- Bullet list
  - Nested items
- Tasks:
  - [x] Create your first note
  - [ ] Build a tagging system
  - [ ] Import old notes

### Code

\`\`\`ts
type Note = {
  id: string
  title: string
  tags: string[]
}

export function describe(note: Note): string {
  return \`\${note.title} · \${note.tags.join(', ')}\`
}
\`\`\`

### Tables

| Capability | Status | Notes |
| --- | --- | --- |
| Auto-save | Supported | Cached and synced to Cloudflare |
| Wiki links | Supported | Aliases and backlinks |
| Export | Supported | Markdown / ZIP |

### Math

Inline: $E = mc^2$.

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

### Mermaid diagram

\`\`\`mermaid
flowchart LR
  A[Capture an idea] --> B[Markdown note]
  B --> C[Wiki links]
  C --> D[Knowledge graph]
\`\`\`

### Quotes and footnotes

> A good tool should make thinking easier, not turn organizing the tool into the work.[^1]

[^1]: This is a footnote.
`,
}

export function getSeedContent(locale: Locale): SeedContent {
  if (locale === 'en') return en
  if (locale === 'zh-TW') return zhTW
  return zhCN
}
