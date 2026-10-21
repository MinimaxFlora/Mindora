# Contributing to Mindora

感谢你愿意改进 Mindora。这个项目偏好小而清晰的改动，并特别重视数据安全、账户隔离、可访问性和真实可用性。

## 开发环境

- Node.js 22+
- pnpm 11+
- Cloudflare Wrangler（项目依赖中已包含）
- 推荐最新版 Chrome 或 Edge（端到端测试默认使用本机 Chrome）

```bash
pnpm install
pnpm db:local
pnpm dev
```

`wrangler.jsonc` 中的 D1 / KV ID 属于维护者账户。Fork 后请创建自己的资源并替换，或只使用本地模拟。

## 提交前检查

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e --project=desktop-chrome
pnpm test:e2e --project=mobile-chrome
```

`pnpm test:e2e` 会先把迁移应用到本地 D1。CI 使用 Playwright 自带 Chromium。

## 代码约定

- 使用 TypeScript 严格模式，不使用 `any` 绕过类型问题。
- 优先复用 `src/components/ui` 和现有 hooks；不要引入另一套 UI 框架。
- 所有可见按钮必须有真实行为、键盘可达名称和禁用 / 加载状态。
- 笔记的权威数据在 D1；IndexedDB 只是缓存，不要把业务逻辑建立在“本地是唯一数据源”的假设上。
- 任何新 API 都必须先认证，再按会话中的 `user_id` 查询或写入。
- 多表写入使用 D1 `batch`；客户端本地缓存写入使用 Dexie 事务。
- 外部 HTML 必须经过 `rehype-sanitize`；不要为了支持某个 Markdown 特性而放宽脚本或事件属性。
- 不要直接复制其他笔记产品的品牌、图标、文案或专有界面。

## 国际化

所有用户可见文案必须通过 `useI18n()`：

```tsx
const { t } = useI18n()
return <button>{t('common.newNote')}</button>
```

- 词典：`src/i18n/messages.ts`，必须同时补齐 `en`、`zh-CN`、`zh-TW`。
- 文案不得写死在 JSX、`aria-label`、`title` 或 Toast 中。
- 带数量词时使用 `{ count }`，并遵循词典中的 `单数|复数` 格式。
- 日期和数字使用 `src/lib/utils.ts` 与 `src/lib/locale.ts` 中的本地化函数。
- 新增文案后运行 `pnpm test`；词典键一致性由测试覆盖。

更多细节见 [`docs/I18N.md`](./docs/I18N.md)。

## 数据、认证与迁移

- 修改 D1 schema 时新增 `migrations/000N_*.sql`，不要编辑已发布的迁移。
- 生产迁移通过 `pnpm db:migrate` 或部署工作流执行。
- 修改认证/会话时，必须考虑：密码哈希升级、会话撤销、Cookie 属性、Origin 校验和用户隔离。
- 新 API 必须验证输入长度、类型和授权边界。
- 不自动删除用户数据；永久删除必须有确认流程。
- 备份格式变更必须升级 `manifest.version`，并保留对旧版本的明确处理。
- 导入失败必须保持现有数据完整，优先依赖事务回滚。

## Pull Request

请在 PR 中说明：

1. 改变了什么，以及为什么。
2. 对 D1 schema、认证、同步或备份的影响。
3. 执行的检查命令与结果。
4. 已知限制或未覆盖的边界情况。
5. 如涉及 UI，附桌面与移动端截图（不要包含真实私人笔记）。

不要虚构测试结果、CI 状态或线上演示地址。
