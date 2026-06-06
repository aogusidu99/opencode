---
name: login-secrets
description: Safe handling of account login, API keys, OAuth authorization, local secret files, CLI credentials, and browser login flows. Use when Codex needs credentials, tokens, cloud authentication, API access, OAuth consent, Google/Microsoft/GitHub login, or any task that could expose secrets.
---

# 登录与密钥使用

## 核心原则

- 不要求用户在聊天中粘贴账号、密码、API Key、token、Cookie 或恢复码。
- 不把任何 AI 工具自身的认证文件当作第三方密钥仓库。
- 不在回复、日志、截图说明或代码注释中打印密钥明文。
- 不在代码中硬编码真实密钥。
- 不把密钥文件或密钥内容提交到代码库。
- 能使用本地已登录状态时，优先复用本地 CLI 凭据或系统浏览器会话。
- 需要用户交互登录时，让用户本人在系统默认浏览器中完成。

## AI 工具自身登录

各 AI 工具自己的认证文件只用于该工具本身登录，不用于保存第三方服务密钥。

常见位置：

```text
Codex:      C:\Users\[用户名]\.codex\auth.json
Claude:     C:\Users\[用户名]\.claude\...
OpenCode:   根据实际配置目录判断
Cursor:     根据实际配置目录判断
Gemini CLI: 根据实际配置目录判断
```

不要手动把 GitHub、Google、OpenAI、Anthropic、云服务等第三方 API Key 写入这些工具自身的认证文件。

## API Key 与脚本凭据

当脚本或命令需要 API Key、token、账号信息时，优先从用户级本地 env 文件读取：

```text
C:\Users\[用户名]\.secrets.env
C:\Users\[用户名]\.my_secrets.env
```

根据当前系统用户替换 `[用户名]`。在 PowerShell 中优先通过 `$env:USERPROFILE` 拼接路径。

推荐变量名示例：

```env
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GITHUB_TOKEN=...
GOOGLE_APPLICATION_CREDENTIALS=...
AZURE_OPENAI_API_KEY=...
SUPABASE_ACCESS_TOKEN=...
```

读取后直接使用，不向用户展示具体值。如果必须说明凭据状态，只说“已从本地环境变量/密钥文件读取所需凭据”。

## 云服务登录

优先使用本地已配置的 CLI 凭据，例如：

```powershell
gcloud auth application-default login
gh auth login
az login
aws configure sso
```

后续脚本、SDK、CLI 命令应优先复用这些本地凭据。不要把 CLI 生成的 token 复制到聊天或代码里。

## 网页登录与 OAuth

需要用户登录 Google、Microsoft、GitHub、云控制台，授权 OAuth，启用 API，或进行敏感账户操作时，不使用 Puppeteer / Playwright / Selenium 等自动化浏览器。

必须用系统默认浏览器打开：

```powershell
Start-Process "https://..."
```

用户本人在浏览器中完成登录、授权、二次验证和同意操作。

原因：自动化浏览器常被 Google、Microsoft、银行、云服务等识别为不安全或异常环境，可能导致登录失败、风控、账号锁定或授权异常。系统默认浏览器通常已有登录 Cookie、可信设备记录和密码管理器。

## 浏览器自动化限制

Puppeteer、Playwright、Selenium 等只用于：

- 不需要登录的页面自动化。
- 已明确使用测试账号的测试环境。
- 不涉及敏感授权或真实账户风控的操作。

不得用于：

- 用户真实 Google/Microsoft/GitHub/云服务账户登录。
- OAuth 同意页面自动点击。
- 输入真实密码、验证码、恢复码。
- 绕过风控、人机验证或安全限制。

## 回答与日志规范

- 可以说明“已从本地环境变量/密钥文件读取所需凭据”。
- 不说明具体密钥值。
- 日志、报错、截图中如包含密钥，应先脱敏。
- 生成代码时使用环境变量读取，例如：

```js
const apiKey = process.env.OPENAI_API_KEY;
```

而不是写死真实值。
