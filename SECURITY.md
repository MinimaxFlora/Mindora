# Security Policy

## 报告安全问题

请不要在公开 Issue 中披露可利用细节。优先使用 GitHub 的 **Security → Report a vulnerability**（私有安全公告），或通过仓库所有者提供的私有渠道联系维护者。

请包含：

- 影响版本或 commit。
- 最小复现步骤。
- 影响范围（账户绕过、越权、XSS、数据泄露、依赖漏洞等）。
- 你建议的修复方式（如有）。

## 支持范围

当前仅维护 `0.1.x` 系列的 `main` 分支。项目处于早期阶段，不承诺旧版本的长期安全修复。

## 安全模型

Mindora 是**在线单用户笔记应用**：

- 应用和 API 部署在 Cloudflare Workers。
- 笔记、文件夹、标签、附件元数据和用户/会话记录存储在 Cloudflare D1。
- 图片二进制存储在 Cloudflare KV。
- 浏览器 IndexedDB 只是缓存，不是唯一数据源。
- 每个用户只能访问自己的 `user_id` 数据。
- 公开注册默认开启；任何能访问站点的人都可以创建账户。

### 公网部署

推荐：

1. 使用 HTTPS 自定义域名。
2. 定期应用 D1 迁移。
3. 如需限制谁能看到登录页，额外配置 Cloudflare Access。
4. 监控 Workers / D1 错误和异常登录量。

**Cloudflare Access 是额外边界，不是 Mindora 登录的替代品。** Mindora 自身的账户和 D1 隔离仍然生效。

## 已实施的防护

- 密码：PBKDF2-SHA256，100,000 次迭代（Cloudflare Workers WebCrypto 上限），16 字节随机盐，256-bit 派生结果；存储格式带算法和迭代次数，便于未来升级。
- 会话：256-bit 随机令牌；数据库只存 SHA-256 哈希；30 天过期。
- Cookie：`HttpOnly`、`SameSite=Lax`、`Path=/`，HTTPS 下 `Secure`。
- 写请求校验 `Origin`，拒绝跨源请求；依赖 SameSite Cookie 降低 CSRF 风险。
- 所有笔记、文件夹、附件查询都带 `user_id`，不信任客户端传入的用户身份。
- 附件下载先校验 D1 元数据归属，再从 KV 取二进制；只接受栅格图片，拒绝 SVG。
- 登录失败与注册按 IP / 邮箱计数限流；失败响应不区分邮箱是否存在。
- 账户注销会清除 D1 中的用户、会话、笔记、文件夹、附件元数据，以及 KV 图片。
- Markdown 渲染使用 `rehype-sanitize`；过滤脚本、事件处理器、危险 URL 协议。
- 外链 `noopener noreferrer`；外部图片 `referrerpolicy="no-referrer"`。
- 生产 CSP：`script-src 'self'`、`object-src 'none'`、`frame-ancestors 'none'` 等；同时设置 HSTS、`X-Frame-Options: DENY`、`Referrer-Policy`。
- Mermaid `securityLevel: 'strict'`。
- ZIP 解压限制文件数量与总大小；导入使用事务回滚。
- API 请求体大小限制；笔记正文单篇 4 MB、附件 20 MB、单次同步最多 500 篇。
- 附件只接受图片 MIME 类型。

## 已知风险与边界

- **没有邮箱验证**：注册时可以使用不属于自己的邮箱；没有账号找回流程。
- **没有密码重置**：忘记密码将无法登录，请妥善保存凭据。
- **限流不是验证码**：登录失败按 IP + 邮箱限制 10 次 / 15 分钟，注册按 IP 限制 20 次 / 小时；分布式 IP 攻击仍可能绕过单 IP 限制。
- **账户删除不可恢复**：设置页可以注销账户并清除 D1/KV 数据，但删除后无法恢复；应先导出备份。
- **公开注册**：默认任何访问者都可以创建账户。需要封闭使用时，请加 Cloudflare Access 或后续实现邀请码。
- **同步冲突**：最后写入者优先；极端并发编辑可能覆盖较早版本。
- **本地缓存**：退出登录会清除缓存，但设备上残留的浏览器缓存或备份文件仍可能包含笔记。
- **D1/KV 未端到端加密**：Cloudflare 提供基础设施层加密；项目未实现用户自持密钥的 E2E 加密。
- **ZIP 备份未加密**：请自行加密或安全保存。
- **第三方图片**：外部图片由远端服务器提供，Mindora 不代理。
- **依赖供应链**：使用锁文件与 pnpm 构建脚本白名单；仍建议定期审计依赖。

## 安全开发要求

- 不得移除 sanitize、CSP、Origin 校验或 `user_id` 过滤来换取功能。
- 任何新 API 都必须先认证，再按 `user_id` 授权。
- 新增 HTML 标签 / 属性前，必须评估 XSS 风险并补测试。
- 不得把密钥、Token、密码或 `.dev.vars` 提交到仓库。
- 修改密码/会话实现时，必须同时更新本文和迁移说明。
- 发现测试失败时修复根因，不要跳过安全检查。
