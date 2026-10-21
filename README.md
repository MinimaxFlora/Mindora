# Mindora

**让思绪自然生长。** Mindora 是一个部署在 Cloudflare 上的在线 Markdown 笔记与个人知识管理工作台。

登录后，笔记、文件夹、标签和图片附件保存在 **Cloudflare D1 + KV**，换浏览器或设备登录同一账户即可继续使用。浏览器 IndexedDB 只作为本地缓存和离线输入缓冲，**不是唯一数据源**。

界面支持 **简体中文 / 繁體中文 / English**。

> 当前版本：`0.1.0`。这是一个真实可用的单用户云端笔记 MVP：有账户注册/登录、D1 持久化、会话 Cookie、图片上传、跨设备同步和端到端测试。
>
> 在线部署：<https://mindora.kejizero.xyz>

---

## 功能

### 在线账户与同步

- 邮箱 + 密码注册/登录，密码使用 PBKDF2-SHA256（100,000 次迭代、随机盐）哈希后存入 D1。
- 30 天会话，随机会话令牌只以 SHA-256 哈希形式入库；Cookie 为 `HttpOnly`、`SameSite=Lax`，生产环境加 `Secure`。
- 登录失败按 IP + 邮箱限流（10 次 / 15 分钟），注册按 IP 限流（20 次 / 小时）。
- 账户自助注销：删除 D1 数据、会话与 KV 图片，操作不可恢复。
- 每个用户只能访问自己的笔记、文件夹、设置和附件（所有查询都带 `user_id`）。
- 浏览器与云端增量同步：创建、编辑、移动、标签、收藏、回收站、恢复、永久删除都会同步。
- 轮询 + 窗口重新聚焦时拉取其他设备上的更新。
- 登录/注册后，重新打开浏览器或换设备仍能看到同一账户的笔记。
- 本地缓存用于快速渲染和编辑，云端是权威数据源。

### 写作与 Markdown

- CodeMirror 6 源码编辑、阅读、分屏三种模式。
- GitHub Flavored Markdown：标题、列表、任务、表格、删除线、脚注、Frontmatter。
- Shiki 按需代码高亮，支持多语言。
- KaTeX 行内 / 块级公式。
- Mermaid 图表；错误时回退到可读信息和源码。
- `[[双向链接]]`、别名、反向链接、出链、未创建链接新建。
- 标题大纲、阅读进度、专注模式、字号 / 行高 / 宽度设置。
- 图片上传到 Cloudflare KV，跨设备可访问。
- 原始 HTML 经 `rehype-sanitize` 过滤；脚本、事件处理器、危险 URL 协议被移除。
- 外链 `noopener` / `noreferrer`；Mermaid `securityLevel: strict`。

### 知识管理

- 文件夹、标签、收藏、最近、回收站、批量操作。
- 本地全文索引（标题、正文、标签、文件夹），数据来自已同步的云端笔记。
- 真实数据生成的知识图谱、缩放平移、筛选、节点搜索。
- 自动保存状态、失败提示、离开前落盘。
- 完整 ZIP 备份（含图片），Markdown 批量导入。
- 恢复 ZIP 时重新映射 ID，并重新上传图片到账户。

### 多语言与界面

- 简体中文 / 繁體中文 / English。
- 语言、主题、编辑器偏好是**设备本地设置**，不上传到账户；笔记内容不自动翻译。
- 浅色 / 深色 / 跟随系统，桌面三栏与移动端全屏编辑。
- 键盘快捷键、语义化 HTML、可访问名称、Radix 焦点管理。

## 技术栈

| 层次 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript 严格模式、Vite、Tailwind CSS 4 |
| 编辑器 | CodeMirror 6 |
| Markdown | remark / rehype、rehype-sanitize、Shiki、KaTeX、Mermaid |
| 本地缓存 | IndexedDB、Dexie |
| 云端数据 | Cloudflare D1（SQLite） |
| 图片存储 | Cloudflare KV |
| 认证 | 邮箱 + 密码、PBKDF2、D1 会话表、HttpOnly Cookie |
| 部署 | Cloudflare Workers + Static Assets、Wrangler |
| 测试 | Vitest、React Testing Library、Playwright |

## 架构

```text
Browser
  React SPA
  ├─ IndexedDB cache (Dexie)      ← fast renders / offline edits
  ├─ local search index
  └─ sync engine (debounced, 30s poll)
          │  same-origin fetch + HttpOnly session cookie
          ▼
Cloudflare Worker
  ├─ /api/auth/*     register, login, logout, session
  ├─ /api/sync       snapshot + incremental push
  ├─ /api/attachments image upload/download
  ├─ D1              users, sessions, notes, folders, attachments
  └─ KV              image binaries
```

- Worker 同时提供 SPA 静态资源和 API。
- `/api/*` 不会回退到 `index.html`。
- 所有写请求校验 Origin（`SameSite=Lax` + 同源检查）。
- 生产环境设置 CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 等安全头。

## 快速开始

要求 Node.js 22+、pnpm 11+、Cloudflare 账户。

仓库中的 `wrangler.jsonc` 已绑定当前项目的 D1 和 KV。若你 fork 后部署到自己的账户，请替换为你的资源 ID。

```bash
pnpm install
pnpm db:local
pnpm dev
```

打开终端输出的地址，注册账户即可使用。

### 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | Vite + Cloudflare 本地开发（含 D1/KV 模拟） |
| `pnpm build` | TypeScript 检查并构建 Worker / 静态资源 |
| `pnpm preview` | 预览构建产物 |
| `pnpm typecheck` | TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest 单元/集成测试 |
| `pnpm test:e2e` | 初始化本地 D1 并运行 Playwright |
| `pnpm check` | 类型、Lint、测试、构建 |
| `pnpm db:local` | 将迁移应用到本地 D1 |
| `pnpm db:migrate` | 将迁移应用到远程 D1 |
| `pnpm deploy` | 构建并部署到 Cloudflare |
| `pnpm cf:check` | Wrangler dry-run 校验 |

## 部署

```bash
pnpm db:migrate
pnpm build
pnpm exec wrangler deploy
```

必须确保：

- 远程 D1 已创建并写入 `wrangler.jsonc` 的 `database_id`。
- 远程 KV namespace 已创建并绑定。
- `migrations/0001_initial.sql` 与 `0002_auth_rate_limits.sql` 已应用到远程 D1。
- 生产域名通过 HTTPS 访问，会话 Cookie 才会带 `Secure`。

完整步骤、GitHub Actions、自定义域名和 Cloudflare Access 额外防护见 **[部署文档](./docs/DEPLOYMENT.md)**。

## 账户、权限与安全

- 注册公开可用；没有邀请码或邮箱验证。
- 当前没有“忘记密码”、邮箱验证、登录验证码或管理员后台。
- 数据隔离按 `user_id` 实现；没有共享空间或协作权限模型。
- 密码和会话实现见 `src/worker-api.ts`。
- 公网部署可以额外套一层 **Cloudflare Access**，在到达 Worker 前拒绝未授权访客；这不是应用登录的替代品。
- 详细威胁模型与报告方式见 [SECURITY.md](./SECURITY.md)。

> 公开注册意味着任何能访问站点的人都可以创建账户。如果你只想让特定的人使用，请关闭注册入口或增加 Cloudflare Access / 邀请机制。

## 数据与备份

- 云端数据：D1 存笔记、文件夹、附件元数据、用户和会话；KV 存图片。
- 本地缓存：IndexedDB 数据库 `mindora`，用于快速加载和离线输入；退出登录会清除缓存。
- 设置页可导出完整 ZIP（笔记、文件夹、附件、设置）。
- 导入 Markdown 或恢复 ZIP 后会同步到当前账户。
- 清除浏览器站点数据不会删除云端笔记；重新登录即可恢复。
- ZIP 备份和 D1 数据均未做端到端加密；请妥善保管密码与备份。

## 已知限制

- 没有密码重置、邮箱验证、团队空间、实时协作。
- 单用户单工作区；不支持共享笔记。
- 同步为最后写入者优先；极端并发编辑可能覆盖较早版本。
- 浏览器每 30 秒轮询一次其他设备更新；不是 WebSocket 实时同步。
- 大附件上限 20 MB；图片走 KV。
- 本地搜索索引在浏览器构建，不跨设备同步搜索结果。
- 语言/主题/编辑器偏好是设备本地设置，不随账户同步。
- 外部图片仍由第三方源提供；Mindora 会加 `no-referrer` 和懒加载。
- 多语言只覆盖界面与引导内容，不翻译用户笔记。

## 项目结构

```text
src/
  components/       应用框架、笔记列表、编辑器、图谱、认证、设置
  db/               Dexie 本地缓存、类型、初始化内容、数据操作
  hooks/            自动保存、创建笔记、防抖
  i18n/             三语词典与 useI18n
  lib/              Markdown、搜索、双向链接、图谱、备份
  pages/            路由页面
  providers/        认证、同步、数据、设置、UI 状态
  sync/             API 客户端与变更追踪
  worker-api.ts     D1/KV 认证与同步 API
  worker.ts         Worker 入口、SPA 与安全头
migrations/         D1 schema 迁移
e2e/                Playwright 测试
docs/               部署与国际化说明
public/             静态资源与主题引导
```

## 参与贡献

请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 与 [SECURITY.md](./SECURITY.md)。

## 许可证

[MIT](./LICENSE) © 2026 MinimaxFlora

第三方依赖保留各自许可证；项目未复制 Obsidian、Notion、Craft、Bear 或 Logseq 的专有资源与品牌素材。
