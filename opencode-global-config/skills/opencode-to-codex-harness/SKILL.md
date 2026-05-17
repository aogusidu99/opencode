---
name: opencode-to-codex-harness
description: 将高度定制化的 OpenCode agent harness 转换为 Codex 可用的 harness，同时保持五层意图一致：Memory/Rules、Runtime Config、Skills、MCP/Tools、Secrets/Accounts。用户要求复制、迁移、同步、对比、适配 OpenCode 全局 AGENTS/config/skills/MCP/secrets 到 Codex 时使用，尤其适用于需要差异清单以避免误删 Codex 专属规则、插件、marketplace、模型、可信项目或已安装 skills 的场景。Keywords: copy, port, sync, migrate, compare, adapt.
---

# OpenCode 到 Codex Harness 迁移

这个 skill 用来把 OpenCode 作为源 harness，把 Codex 作为目标 harness。目标不是逐字复制配置文件，而是保持五层意图一致，并生成 Codex 能实际理解的规则、配置、skills、工具映射和差异清单。

## 迁移范围

按五层处理：

1. Memory / Rules
   - 来源：`opencode-global-config/AGENTS.md`
   - 目标：`%USERPROFILE%\.codex\AGENTS.md`
   - 处理方式：合并规则，不整文件覆盖；保留 Codex 已有规则。
2. Runtime Config
   - 来源：`opencode-global-config/opencode.json`、`opencode-global-config/tui.json`
   - 目标：`%USERPROFILE%\.codex\config.toml`
   - 处理方式：只合并等价意图；保留 Codex 的 model、sandbox、approval、marketplaces、plugins、trusted projects。
3. Skills
   - 来源：`opencode-global-config/skills/*/SKILL.md`
   - 目标：`%USERPROFILE%\.codex\skills\<skill-name>\SKILL.md`
   - 处理方式：只迁移用户自定义 skills；不复制 `.system`；OpenCode-only 路径要加可移植说明。
4. MCP / Tools
   - 来源：`opencode.json` 里的 MCP 配置和 `opencode-global-config/mcp-scripts/**`
   - 目标：Codex plugins/connectors、app tools，或已确认可用的 Codex MCP 配置。
   - 处理方式：先生成覆盖关系和缺口报告；不要假设 OpenCode MCP 等于 Codex plugin。
5. Secrets / Accounts
   - 来源：MCP env 路径、OAuth token 路径、本地 `.my_secrets.env` / `.secrets.env`
   - 目标：Codex secret policy、connector auth、本地 env 文件引用。
   - 处理方式：只保留路径引用和规则文本；不复制 token、API key、refresh token 或 credential 内容。

## 工作流程

### 1. 采集 OpenCode Harness

读取这些来源：

- `opencode-global-config/AGENTS.md`
- `opencode-global-config/opencode.json`
- `opencode-global-config/tui.json`
- `opencode-global-config/skills/*/SKILL.md`
- `opencode-global-config/mcp-scripts/**`
- OpenCode MCP `environment` 字段里的本地密钥路径引用

只采集密钥路径引用。除非后续操作必须静默使用，否则不要读取密钥值，更不能输出密钥值。

### 2. 读取 Codex 目标现状

迁移前读取当前 Codex 目标文件：

- `%USERPROFILE%\.codex\AGENTS.md`
- `%USERPROFILE%\.codex\config.toml`
- `%USERPROFILE%\.codex\skills`
- 当前 Codex plugins、connectors、marketplaces、trusted projects

把现有 Codex 配置视为用户资产，不视为可覆盖的生成物。

### 3. 保留 Codex 专属配置

如果存在，必须保留并在差异清单里列出：

- `model`
- `model_reasoning_effort`
- `sandbox_mode`
- `approval_policy`
- `[windows]`
- `[marketplaces.*]`
- `[plugins.*]`
- `[projects.*]`
- 现有且不与 OpenCode 源规则冲突的 `developer_instructions`
- `%USERPROFILE%\.codex\skills` 下已有的 Codex skills

如果 OpenCode 规则更严格或更具体，把它追加到 Codex 说明里，不要删除 Codex 原有文本。

### 4. 生成 Codex Memory / Rules

把 OpenCode `AGENTS.md` 渲染为 Codex `AGENTS.md`：

- 保留中文优先交流规则。
- 保留当前 workspace 默认可编辑策略。
- 保留密钥文件读取顺序和禁止输出密钥规则。
- 保留浏览器登录规则：Google/OAuth 登录必须使用系统默认浏览器，不使用 Puppeteer 或自动化 Chromium。
- 保留高危命令确认策略。
- 增加简短来源说明，例如：`源自 OpenCode 全局 harness；保留 Codex 在 config.toml 中的专属运行配置。`

不要删除 Codex 中已有但 OpenCode 没有的章节。

### 5. 生成 Codex Runtime Config

把 OpenCode 的运行时意图映射到 `config.toml`：

- 把长期行为写进 `developer_instructions`。
- 保留 Codex 的 sandbox 和 approval 设置，除非用户明确要求修改。
- 把 OpenCode 权限意图转换为说明性规则，因为 Codex 的权限执行还受运行时沙箱和审批策略影响。
- 不要把 OpenCode TUI 快捷键强行写进 Codex，除非 Codex 支持同等动作。
- 保留现有 Codex plugin 条目。
- 写入 TOML 三引号字符串时，不要使用未转义的 Windows 反斜杠路径，例如 `%USERPROFILE%\.secrets.env`。应写成 `%USERPROFILE%/.secrets.env`，或把反斜杠加倍为 `%USERPROFILE%\\.secrets.env`。

向 `developer_instructions` 增加内容时，按这些标题合并：

- `Permission policy`
- `Command permission policy`
- `Secrets policy`
- `Browser login policy`
- `OpenCode parity notes`

### 6. 迁移 Skills

对每个 OpenCode skill：

1. 判断正文是否可移植。
2. 如果 `name` 和 `description` 已经 agent-neutral，可以保留。
3. 把 OpenCode-only 路径改成 portability note。
4. 只有用户批准后才复制到 Codex。
5. 如果 skill 依赖 OpenCode-only TUI API，标记为 `manual-review`，不要静默安装。

默认目标路径：

```text
%USERPROFILE%\.codex\skills\<skill-name>\SKILL.md
```

不要复制 `.system` skills。不要覆盖已有 Codex skills，除非用户批准。

### 7. 处理 MCP / Tools

Codex 可能通过 plugins/connectors 提供 Google Drive、Gmail、Calendar、browser、documents、spreadsheets、presentations，而不是通过原始 MCP JSON。因此：

- 保留现有 Codex plugin connector 条目。
- 先把 OpenCode MCP server 转成覆盖关系报告。
- 已由 Codex plugin 覆盖的 server 标记为 `covered-by-plugin`。
- `gemini-search` 这类自定义 MCP 脚本，在确认 Codex MCP adapter 之前标记为 `needs-codex-mcp-adapter`。
- 只有确认当前 Codex 环境支持目标 MCP 配置路径后，才写入原始 MCP 配置。

不要把 OAuth token JSON 或 credential 文件复制到仓库。只保留现有本地路径引用。

## 当前 OpenCode 来源中要保留的内容

Memory / Rules：

- 中文优先交流。
- 当前 workspace 是默认可编辑范围。
- 编辑当前打开 workspace 以外文件前先询问。
- 读取通常允许。
- 需要时静默读取密钥文件；绝不输出密钥值。
- Google 登录、OAuth、API 启用必须使用系统默认浏览器，不使用 Puppeteer。
- 高危命令策略：大多数 shell 命令允许；递归危险删除、`sudo`、生产 push/publish/deploy、`aws`、`vercel`、`prod` 需要确认。

Runtime Config：

- `experimental.disable_paste_summary = true`
- `permission.edit` 规则：`* = ask`、`** = allow`、lock 文件 deny、`.env*` deny、`.git/**` deny
- `read = allow`
- `glob`、`grep`、`list`、`task`、`webfetch`、`websearch`、`external_directory` 为 allow
- `bash` 默认 allow，高危命令模式 ask
- TUI 快捷键：`model_cycle_favorite = f4`、`model_cycle_favorite_reverse = shift+f4`

MCP / Tools：

- `puppeteer`
- `gdrive`
- `gmail`
- `gcalendar`
- `gemini-search`

Skills：

- `skill-creator`
- `codex-opencode-skill-creator`
- `opencode-global-config/skills` 下未来新增的其他用户技能

## 当前 Codex 目标中要保留的内容

不要因为 OpenCode 没有等价项就删除这些内容：

- `model = "gpt-5.5"`
- `model_reasoning_effort = "medium"`
- `sandbox_mode = "workspace-write"`
- `approval_policy = "on-request"`
- `[windows] sandbox = "elevated"`
- `[marketplaces.openai-bundled]`
- `[marketplaces.openai-primary-runtime]`
- `[plugins."browser@openai-bundled"]`
- `[plugins."documents@openai-primary-runtime"]`
- `[plugins."spreadsheets@openai-primary-runtime"]`
- `[plugins."presentations@openai-primary-runtime"]`
- `[plugins."google-drive@openai-curated"]`
- `[plugins."gmail@openai-curated"]`
- `[plugins."google-calendar@openai-curated"]`
- `[projects.*]` 下的可信项目
- 现有 `%USERPROFILE%\.codex\skills\.system`
- 现有 `%USERPROFILE%\.codex\skills\login-secrets`

## OpenCode 到 Codex 转换说明

权限：

- OpenCode 在 JSON 里有结构化权限规则。
- Codex 的实际行为由用户规则、系统/开发者指令、sandbox policy、tool approval 和 plugin/tool 可用性共同决定。
- 把 OpenCode 权限转换为 `AGENTS.md` 行为规则、`developer_instructions` 运行时注入规则，并保留 Codex 原有 `sandbox_mode` 和 `approval_policy`。
- 如果 Codex runtime 在 allow 规则下仍要求确认，以 runtime sandbox 为准。

MCP 与 Plugins：

- `gdrive` 对应 `google-drive@openai-curated`；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `gmail` 对应 `gmail@openai-curated`；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `gcalendar` 对应 `google-calendar@openai-curated`；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `puppeteer` 对应 `browser@openai-bundled` 或 browser skill/plugin；标记为部分覆盖，浏览器登录策略仍要保留。
- `gemini-search` 没有保证内置等价项；标记为人工审阅或需要自定义 Codex MCP adapter。

Skills：

- 只复制用户自定义 skills。
- 不覆盖 Codex `.system` skills。
- 如果某个 skill 引用了 `opencode-global-config` 这类 OpenCode-specific 路径，添加 portability note，或创建 Codex-specific 变体。

Secrets：

- 可以列出 `%USERPROFILE%/.my_secrets.env`、`%USERPROFILE%/.secrets.env`、OAuth token 文件路径和 credential 文件路径。
- 如果必须在 TOML basic string 或 multiline basic string 中写 Windows 路径，使用正斜杠或双反斜杠；单个反斜杠会触发 TOML 转义解析错误。
- 禁止输出 token 内容、API key 值、refresh token 或 client secret。
- 禁止把 credential 文件复制进生成文件或仓库。

## 差异清单

应用前 dry-run 或应用后必须输出差异清单，包含：

- Codex 中保留：目标原本已有、继续保留的规则和配置。
- 从 OpenCode 新增：迁移后新增到 Codex 的规则、配置或 skill。
- OpenCode 专属 / 需要人工审阅：无法直接映射的 TUI、MCP 或路径。
- Codex 专属 / 不要删除：Codex 的 plugins、marketplaces、模型、sandbox、trusted projects、系统 skills。
- 密钥引用：只列路径，不列值。
- 下一步：需要用户确认、重新授权或手动验证的事项。

重点关注“Codex 专属 / 不要删除”，因为 Codex 通常比 OpenCode 有更多插件、marketplace、模型、sandbox 和 trusted projects 配置。

## 安全应用

只有用户批准后才执行写入：

1. 带时间戳备份目标文件。
2. 增量写入变更。
3. 验证 TOML、JSON 和 skill frontmatter。
4. 检查 `developer_instructions` 等 TOML basic string 中不存在非法转义，例如 `\.`、`\U`、`\a` 这类未转义 Windows 路径片段。
5. 重新读取目标文件，确认应保留章节仍存在。
6. 报告准确改动路径。

如果验证失败，停止并说明问题。只有用户确认后才从备份恢复。

## 安全规则

- 不输出密钥值。
- 不提交 token 或 credential 文件。
- 不整文件覆盖 Codex `config.toml`。
- 不为了匹配 OpenCode 而删除 Codex 现有 plugin、marketplace 或 trusted project。
- 不假设 OpenCode MCP 等于 Codex plugin。必须报告覆盖关系和缺口。
- 未在目标环境列出或调用成功前，不声称某个已迁移 MCP 可用。

## 示例

用户：“把 OpenCode 的 harness 同步到 Codex，规则本质一致，差异列出来。”

处理方式：

1. 读取 OpenCode 和 Codex 源文件。
2. 生成五层映射说明。
3. 列出 Codex-only 项，例如 `browser`、`documents`、`spreadsheets`、`presentations`、`google-drive`、`gmail`、`google-calendar`、marketplaces、model、sandbox 和 trusted projects。
4. 展示 dry-run 变更。
5. 写入 `%USERPROFILE%\.codex` 前征得用户确认。
