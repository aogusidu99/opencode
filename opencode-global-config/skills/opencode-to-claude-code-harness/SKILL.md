---
name: opencode-to-claude-code-harness
description: 将高度定制化的 OpenCode agent harness 转换为 Claude Code 可用的 harness，同时保持五层意图一致：Memory/Rules、Runtime Config、Skills、MCP/Tools、Secrets/Accounts。用户要求复制、迁移、同步、对比、适配 OpenCode 全局 AGENTS/config/skills/MCP/secrets 到 Claude Code 时使用，尤其适用于需要差异清单以避免误删 Claude Code 专属规则、hooks、subagents、slash commands、插件市场或已安装 skills 的场景。Keywords: copy, port, sync, migrate, compare, adapt.
---

# OpenCode 到 Claude Code Harness 迁移

这个 skill 用来把 OpenCode 作为源 harness，把 Claude Code 作为目标 harness。目标不是逐字复制配置文件，而是保持五层意图一致，并生成 Claude Code 能实际理解的规则、配置、skills、工具映射和差异清单。

## 迁移范围

按五层处理：

1. Memory / Rules
   - 来源：`opencode-global-config/AGENTS.md`
   - 目标：`%USERPROFILE%\.claude\CLAUDE.md`
   - 处理方式：合并规则，不整文件覆盖；保留 Claude Code 已有规则。
2. Runtime Config
   - 来源：`opencode-global-config/opencode.json`、`opencode-global-config/tui.json`
   - 目标：`%USERPROFILE%\.claude\settings.json`
   - 处理方式：只合并等价意图；保留 Claude Code 的 permissions、env、hooks、statusLine、includeCoAuthoredBy、cleanupPeriodDays、apiKeyHelper、awsAuthRefresh 等专属字段。
3. Skills
   - 来源：`opencode-global-config/skills/*/SKILL.md`
   - 目标：`%USERPROFILE%\.claude\skills\<skill-name>\SKILL.md`
   - 处理方式：只迁移用户自定义 skills；不复制 `.system` 或 plugin marketplace 分发的 skills；OpenCode-only 路径要加可移植说明。
4. MCP / Tools
   - 来源：`opencode.json` 里的 MCP 配置和 `opencode-global-config/mcp-scripts/**`
   - 目标：Claude Code `settings.json` 的 `mcpServers` 字段或项目级 `.mcp.json`，以及 plugin marketplace 提供的等价连接器。
   - 处理方式：先生成覆盖关系和缺口报告；不要假设 OpenCode MCP 等于 Claude Code plugin。
5. Secrets / Accounts
   - 来源：MCP env 路径、OAuth token 路径、本地 `.my_secrets.env` / `.secrets.env`
   - 目标：Claude Code `apiKeyHelper`、`env`、MCP 服务器 `env` 字段、本地 env 文件引用。
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

### 2. 读取 Claude Code 目标现状

迁移前读取当前 Claude Code 目标文件：

- `%USERPROFILE%\.claude\CLAUDE.md`
- `%USERPROFILE%\.claude\settings.json`
- `%USERPROFILE%\.claude\agents\*.md`
- `%USERPROFILE%\.claude\commands\*.md`
- `%USERPROFILE%\.claude\skills\`
- `%USERPROFILE%\.claude\plugins\`（marketplace 插件）
- `%USERPROFILE%\.claude\keybindings.json`
- 当前 Claude Code hooks、subagents、slash commands、output styles、statusline 配置

把现有 Claude Code 配置视为用户资产，不视为可覆盖的生成物。

### 3. 保留 Claude Code 专属配置

如果存在，必须保留并在差异清单里列出：

- `model`（在 settings.json 中或通过 `/model` 设置的首选模型）
- `permissions.allow` / `permissions.deny` / `permissions.ask`
- `hooks`（PreToolUse / PostToolUse / UserPromptSubmit / Stop / Notification / SubagentStop / SessionStart / SessionEnd / PreCompact）
- `statusLine`
- `apiKeyHelper`
- `env`
- `includeCoAuthoredBy`、`cleanupPeriodDays`
- `enableAllProjectMcpServers`、`enabledMcpjsonServers`、`disabledMcpjsonServers`
- `%USERPROFILE%\.claude\agents\` 下已有的用户 subagent
- `%USERPROFILE%\.claude\commands\` 下已有的 slash command
- `%USERPROFILE%\.claude\skills\` 下已有的 Claude Code skills
- `%USERPROFILE%\.claude\plugins\` 下的 marketplace 插件目录
- `%USERPROFILE%\.claude\keybindings.json`

如果 OpenCode 规则更严格或更具体，把它追加到 Claude Code 说明里，不要删除 Claude Code 原有文本。

### 4. 生成 Claude Code Memory / Rules

把 OpenCode `AGENTS.md` 渲染为 Claude Code `CLAUDE.md`：

- 保留中文优先交流规则。
- 保留当前 workspace 默认可编辑策略。
- 保留密钥文件读取顺序和禁止输出密钥规则。
- 保留浏览器登录规则：Google/OAuth 登录必须使用系统默认浏览器，不使用 Puppeteer 或自动化 Chromium。
- 保留高危命令确认策略。
- 增加简短来源说明，例如：`源自 OpenCode 全局 harness；保留 Claude Code 在 settings.json 中的专属 hooks、subagents、slash commands 和 plugin 配置。`

不要删除 Claude Code 中已有但 OpenCode 没有的章节。

### 5. 生成 Claude Code Runtime Config

把 OpenCode 的运行时意图映射到 `settings.json`：

- 把长期行为写进 `CLAUDE.md`（Claude Code 没有 `developer_instructions` 字段；持久规则在 memory 文件里生效）。
- 保留 Claude Code 的 hooks 和 permissions，除非用户明确要求修改。
- 把 OpenCode 权限意图映射到 `permissions.allow` / `permissions.deny` / `permissions.ask` 数组；OpenCode JSON 的 `* = ask`、`** = allow`、`.env* = deny`、`.git/** = deny` 这类通配规则要逐条对应。
- 不要把 OpenCode TUI 快捷键强行写进 Claude Code，除非用户已在 `keybindings.json` 自定义。
- 保留现有 hooks 条目；新增 hook 时使用 append 模式，不要覆盖已有 hook 数组。
- JSON 字符串里的 Windows 路径反斜杠必须双写：`%USERPROFILE%\\.secrets.env`；或统一使用正斜杠 `%USERPROFILE%/.secrets.env`，避免单反斜杠转义错误。
- `env` 字段只放变量名和文件路径引用，不放明文密钥值。

向 `CLAUDE.md` 增加内容时，按这些标题合并：

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
4. 只有用户批准后才复制到 Claude Code。
5. 如果 skill 依赖 OpenCode-only TUI API 或工具，标记为 `manual-review`，不要静默安装。

默认目标路径：

```text
%USERPROFILE%\.claude\skills\<skill-name>\SKILL.md
```

不要复制由 Claude Code plugin marketplace 分发的同名 skills（例如 `anthropic-skills:*`）。不要覆盖已有 Claude Code skills，除非用户批准。

### 7. 处理 MCP / Tools

Claude Code 通过 `settings.json` 的 `mcpServers` 字段、项目级 `.mcp.json` 文件、或 plugin marketplace 安装的连接器提供 Google Drive、Gmail、Calendar、browser 等能力。因此：

- 保留现有 Claude Code plugin 与 MCP 服务器条目。
- 先把 OpenCode MCP server 转成覆盖关系报告。
- 已由 Claude Code plugin 或现有 MCP 服务器覆盖的项标记为 `covered-by-existing`。
- `gemini-search` 这类自定义 MCP 脚本，可以直接以 stdio 类型加入 `mcpServers`；确认本机有 Node/Bun 可执行后再写入。
- 只有确认当前 Claude Code 环境支持目标 MCP 配置路径后，才写入原始 MCP 配置。

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

- `experimental.disable_paste_summary = true`（Claude Code 没有等价项；作为 portability note 记入 `CLAUDE.md`）
- `permission.edit` 规则：`* = ask`、`** = allow`、lock 文件 deny、`.env*` deny、`.git/**` deny → 映射到 `permissions.deny` 中的 `Edit(./.env*)`、`Edit(./.git/**)`、`Write(./*lock*)` 等条目
- `read = allow` → `permissions.allow` 中的 `Read(**)`
- `glob`、`grep`、`list`、`task`、`webfetch`、`websearch`、`external_directory` 为 allow → 对应 `Glob`、`Grep`、`Agent`、`WebFetch`、`WebSearch` 在 `permissions.allow` 中
- `bash` 默认 allow，高危命令模式 ask → 映射到 `Bash(*)` 在 `permissions.allow`、危险模式在 `permissions.ask`
- TUI 快捷键：`model_cycle_favorite = f4` 等 → 写入 `%USERPROFILE%\.claude\keybindings.json`（如用户启用自定义键位）

MCP / Tools：

- `puppeteer`
- `gdrive`
- `gmail`
- `gcalendar`
- `gemini-search`

Skills：

- `skill-creator`
- `codex-opencode-skill-creator`（迁移时按需改名为 agent-neutral，例如 `cross-agent-skill-creator`）
- `opencode-global-config/skills` 下未来新增的其他用户技能

## 当前 Claude Code 目标中要保留的内容

不要因为 OpenCode 没有等价项就删除这些内容：

- `model = "claude-opus-4-6"` 或用户当前在 `/model` 中选定的默认模型
- `permissions.allow` / `permissions.deny` / `permissions.ask` 现有条目（特别是项目级 `.claude/settings.local.json` 中机器特定的 allow 列表）
- `hooks` 下所有事件的现有命令（PreToolUse、PostToolUse、UserPromptSubmit、Stop、Notification、SubagentStop、SessionStart、SessionEnd、PreCompact）
- `statusLine` 配置
- `apiKeyHelper` 脚本路径
- `env` 中已存在的环境变量
- `includeCoAuthoredBy`、`cleanupPeriodDays`、`enableAllProjectMcpServers` 等顶层字段
- `mcpServers` 中已配置的服务器
- `%USERPROFILE%\.claude\agents\*.md` 中的用户 subagent
- `%USERPROFILE%\.claude\commands\*.md` 中的 slash command
- `%USERPROFILE%\.claude\skills\` 下的用户 skills
- `%USERPROFILE%\.claude\plugins\` 下 marketplace 安装的插件目录
- `%USERPROFILE%\.claude\keybindings.json` 中的自定义键位

## OpenCode 到 Claude Code 转换说明

权限：

- OpenCode 在 JSON 里有结构化权限规则（`permission.edit`、`permission.bash` 等树形结构）。
- Claude Code 用 `permissions.allow` / `permissions.deny` / `permissions.ask` 三个字符串数组，元素形如 `Edit(./.env*)`、`Bash(rm -rf:*)`、`Read(**)`。
- 把 OpenCode 权限转换为 Claude Code 的字符串数组规则，并保留 Claude Code 原有 `permissions.*` 数组中的本地条目。
- 如果某条 OpenCode 规则无法用 Claude Code 的 `Tool(matcher)` 语法精确表达，把它作为说明性规则写进 `CLAUDE.md` 的 `Permission policy` 章节。

MCP 与 Plugins：

- `gdrive` 对应已安装的 Claude Code Google Drive 连接器 / plugin（如 `mcp__gdrive__*`）；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `gmail` 对应 Gmail 连接器；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `gcalendar` 对应 Google Calendar 连接器；plugin 启用时标记为已覆盖，不复制 OAuth 文件。
- `puppeteer` 对应 Claude Code 内置 Browser 工具或 `mcp__Claude_in_Chrome__*`；标记为部分覆盖，浏览器登录策略仍要保留。
- `gemini-search` 没有保证内置等价项；可以直接以 stdio MCP server 形式写入 `mcpServers`，并保留人工审阅标记。

Skills：

- 只复制用户自定义 skills。
- 不覆盖 Claude Code marketplace 分发的同名 skills（例如 `anthropic-skills:skill-creator` 与本地 `skill-creator` 共存时优先保留 marketplace 版本路径，本地版本写入 `%USERPROFILE%\.claude\skills\<skill-name>\` 不冲突）。
- 如果某个 skill 引用了 `opencode-global-config` 这类 OpenCode-specific 路径，添加 portability note，或创建 Claude Code-specific 变体。

Hooks（Claude Code 专属）：

- OpenCode 没有等价的 hooks 系统。
- 如果用户依赖 hooks（例如自动 lint、提交格式化、自动备份触发器），必须保留 Claude Code 现有 hooks。
- 不要因为 OpenCode 源里没有 hook 配置就删除 Claude Code 的 hooks 字段。

Subagents 与 Slash Commands（Claude Code 专属）：

- OpenCode 的 agents/commands 概念可以参考迁移，但 Claude Code 的 subagent 文件必须有 `--- name / description / model / tools ---` 这种 frontmatter；slash command 文件必须有 `--- description / argument-hint ---` frontmatter。
- 迁移时按目标格式重写 frontmatter，正文保持意图一致。

Secrets：

- 可以列出 `%USERPROFILE%/.my_secrets.env`、`%USERPROFILE%/.secrets.env`、OAuth token 文件路径和 credential 文件路径。
- JSON 字符串里 Windows 路径必须用双反斜杠或正斜杠，单反斜杠会触发 JSON 转义错误（`\.`、`\U`、`\a` 等会被解析失败）。
- 禁止输出 token 内容、API key 值、refresh token 或 client secret。
- 禁止把 credential 文件复制进生成文件或仓库。
- `apiKeyHelper` 字段只填脚本路径，不填密钥值；脚本由 Claude Code 在每次启动时调用获取最新 key。

## 差异清单

应用前 dry-run 或应用后必须输出差异清单，包含：

- Claude Code 中保留：目标原本已有、继续保留的规则和配置。
- 从 OpenCode 新增：迁移后新增到 Claude Code 的规则、配置或 skill。
- OpenCode 专属 / 需要人工审阅：无法直接映射的 TUI、MCP 或路径。
- Claude Code 专属 / 不要删除：hooks、subagents、slash commands、plugins、marketplace、keybindings、statusLine、apiKeyHelper、系统 skills。
- 密钥引用：只列路径，不列值。
- 下一步：需要用户确认、重新授权或手动验证的事项。

重点关注"Claude Code 专属 / 不要删除"，因为 Claude Code 通常比 OpenCode 有更多 hooks、subagents、slash commands、marketplace 插件和 IDE 集成配置。

## 安全应用

只有用户批准后才执行写入：

1. 带时间戳备份目标文件。
2. 增量写入变更。
3. 验证 JSON 和 skill frontmatter。
4. 检查 `settings.json` 中字符串字段不存在非法转义，例如 `\.`、`\U`、`\a` 这类未转义 Windows 路径片段。
5. 重新读取目标文件，确认应保留章节仍存在。
6. 报告准确改动路径。

如果验证失败，停止并说明问题。只有用户确认后才从备份恢复。

## 安全规则

- 不输出密钥值。
- 不提交 token 或 credential 文件。
- 不整文件覆盖 Claude Code `settings.json` 或 `CLAUDE.md`。
- 不为了匹配 OpenCode 而删除 Claude Code 现有 hooks、subagents、slash commands、plugins 或 marketplace 配置。
- 不假设 OpenCode MCP 等于 Claude Code plugin。必须报告覆盖关系和缺口。
- 未在目标环境列出或调用成功前，不声称某个已迁移 MCP 可用。

## 示例

用户："把 OpenCode 的 harness 同步到 Claude Code，规则本质一致，差异列出来。"

处理方式：

1. 读取 OpenCode 和 Claude Code 源文件。
2. 生成五层映射说明。
3. 列出 Claude Code-only 项，例如 `hooks`、`subagents`、`slash commands`、`plugins`、`marketplace`、`statusLine`、`apiKeyHelper`、`keybindings`、IDE 集成。
4. 展示 dry-run 变更。
5. 写入 `%USERPROFILE%\.claude` 前征得用户确认。
