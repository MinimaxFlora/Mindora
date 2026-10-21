# Deploying Mindora to Cloudflare

Mindora 是 **Cloudflare Workers + Static Assets + D1 + KV** 的在线笔记应用。Worker 同时提供 SPA、认证 API 和同步 API。

## 先决条件

- Cloudflare 账户
- Node.js 22+
- pnpm 11+
- Wrangler 已登录：`pnpm exec wrangler login`

## 1. 创建 D1 与 KV

```bash
pnpm exec wrangler d1 create mindora-db
pnpm exec wrangler kv namespace create mindora-assets
```

将输出的 `database_id` 和 KV `id` 写入 `wrangler.jsonc`：

```jsonc
{
  "name": "mindora",
  "main": "./src/worker.ts",
  "compatibility_date": "2026-10-01",
  "assets": {
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": true
  },
  "d1_databases": [
    {
      "binding": "MINDORA_DB",
      "database_name": "mindora-db",
      "database_id": "<your-d1-id>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "MINDORA_ASSETS",
      "id": "<your-kv-id>"
    }
  ]
}
```

> 仓库中当前的 ID 属于项目维护者的 Cloudflare 账户。Fork 后必须替换。

## 2. 初始化数据库

本地开发：

```bash
pnpm db:local
```

远程生产：

```bash
pnpm db:migrate
```

迁移文件：`migrations/0001_initial.sql`、`migrations/0002_auth_rate_limits.sql`。`pnpm db:local` / `pnpm db:migrate` 会依次执行，重复执行是幂等的。

表结构：

- `users`：邮箱、PBKDF2 密码哈希
- `sessions`：哈希后的会话令牌、过期时间
- `notes`：标题、Markdown、文件夹、标签、收藏、回收站、时间戳
- `folders`：多级文件夹
- `attachments`：图片元数据（正文二进制在 KV）
- `settings`：当前保留账户级设置字段，客户端偏好主要存设备本地
- `auth_attempts`：按 IP / 邮箱的登录与注册限流计数

## 3. 本地开发

```bash
pnpm install
pnpm db:local
pnpm dev
```

Cloudflare Vite 插件会在本地模拟 Worker、D1 和 KV。开发环境的 `127.0.0.1` / `localhost` 不注入生产 CSP，以免阻断 Vite HMR；API、D1、KV 和会话逻辑仍会执行。

注册一个本地账户即可测试：

- `/api/auth/register`
- `/api/auth/login`
- `/api/sync`
- 图片上传

## 4. 构建与部署

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm db:migrate
pnpm build
pnpm exec wrangler deploy
```

或：

```bash
pnpm deploy
```

构建后：

- `dist/client`：静态资源
- `dist/mindora`：Worker 与生成的 Wrangler 配置
- `.wrangler/deploy/config.json`：让 `wrangler deploy` 使用构建产物

`pnpm cf:check` 执行 dry-run。

## 5. 认证与会话

认证由应用自身完成，不依赖 Cloudflare Access：

- 密码：PBKDF2-SHA256，100,000 次迭代（Workers WebCrypto 上限），随机 128-bit 盐。
- 密码哈希存 D1；明文密码只在注册/登录请求中存在。
- 会话令牌：256-bit 随机值；D1 只存 SHA-256 哈希。
- Cookie：`HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`；HTTPS 下加 `Secure`。
- 写请求校验 `Origin`，并依赖 SameSite Cookie 降低 CSRF 风险。
- 所有 D1 查询按 `user_id` 隔离。

### 当前未实现

- 邮箱验证
- 忘记密码 / 密码重置
- 登录图形验证码 / CAPTCHA
- 管理员后台 / 邀请码

已实现：登录失败 10 次 / 15 分钟（IP + 邮箱）、注册 20 次 / 小时（IP）、账户自助注销。

如果站点公开注册，任何人都可以创建账户。需要限制访问时，使用邀请机制或额外边缘策略。

## Access and Login

> 应用已经内置账户登录。Cloudflare Access 是可选的**额外边界**，不是登录功能的替代品。

如果希望整个站点在到达 Worker 前再经过一层身份验证（例如只允许公司邮箱访问登录页），可以配置 Cloudflare Access：

1. Zero Trust → Access → Applications → Add an application → Self-hosted。
2. 域名填写实际域名。
3. Policy：Allow，指定邮箱、邮箱域名或用户组。
4. 选择 One-time PIN 或现有 IdP。
5. 保存后用无痕窗口验证。
6. 保护不需要的 `workers.dev` 地址，或关闭该路由。

Access 适合：

- 内部部署，只允许团队成员看到登录页。
- 给管理/预览域名增加第二道边界。
- 不希望公开注册入口被扫描。

它不能代替 D1 中的用户隔离，也不能让不同 Access 用户自动拥有不同的 Mindora 数据——Mindora 的数据边界仍是应用账户。

官方文档：<https://developers.cloudflare.com/cloudflare-one/applications/>。

## 6. 自定义域名

Dashboard → Workers & Pages → `mindora` → Settings → Domains & Routes。

生产必须使用 HTTPS，否则会话 Cookie 不会带 `Secure`（本地开发除外）。

## 7. GitHub Actions

仓库包含：

- `.github/workflows/ci.yml`：类型、Lint、单元测试、构建、Playwright。
- `.github/workflows/deploy.yml`：`main` 或手动触发，先跑检查、应用远程迁移、再部署。

GitHub → Settings → Secrets and variables → Actions：

| Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Workers 部署 + D1 迁移 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

建议 Token 仅授予目标账户所需权限：

- Workers Scripts: Edit
- D1: Edit
- Workers KV Storage: Edit
- Account Settings: Read

不要使用 Global API Key。不要提交 `.dev.vars`、Token 或密码。

## 8. 缓存与安全头

Worker 对生产请求设置：

- `/assets/*`：`Cache-Control: public, max-age=31536000, immutable`
- `/theme-init.js`、`/favicon.svg`：1 天
- HTML / SPA：`no-cache`
- API：`no-store`
- CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`、`Strict-Transport-Security`

CSP 允许内联样式（Shiki、KaTeX、Mermaid），脚本只允许同源，不使用 `unsafe-eval`。

## 9. 故障排查

### 刷新深层路由 404

确认 `assets.not_found_handling` 为 `single-page-application`，并部署了 `.wrangler/deploy/config.json` 指向的最新构建。

### API 返回 500 / D1 表不存在

执行：

```bash
pnpm db:migrate
```

并确认 `wrangler.jsonc` 中的 `database_id` 与远程数据库一致。

### 登录后立刻掉线

- 生产是否 HTTPS。
- Cookie 是否被浏览器隐私设置拦截。
- `Origin` 是否与实际域名一致（反向代理改写域名时）。
- 会话是否超过 30 天。

### 图片上传失败

- KV namespace 是否绑定为 `MINDORA_ASSETS`。
- 文件是否超过 20 MB。
- 请求是否已登录且与站点同源。

### 页面空白

- DevTools 查看 CSP 是否阻断资源。
- 确认 `/assets/*`、`/theme-init.js` 可访问。
- 不要用 `file://` 打开 `dist/index.html`。

## 10. 未使用的服务

- 没有 R2：图片存 KV。
- 没有 Durable Objects：当前轮询同步足够单用户使用。
- 没有 D1 以外的服务端数据库。

未来若加入实时协作，需要重新设计冲突合并、权限、在线状态和审计，而不是简单广播最后写入。
