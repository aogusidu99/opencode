---
name: opencode-to-antigravity-harness
description: 将高度定制化的 OpenCode agent harness 转换为 Antigravity 可用的 harness，同时保持五层意图一致：Memory/Rules、Runtime Config、Skills、MCP/Tools、Secrets/Accounts。用户要求复制、迁移、同步、对比、适配 OpenCode 全局 AGENTS/config/skills/MCP/secrets 到 Antigravity 时使用，尤其适用于需要差异清单以避免误删 Antigravity 专属 VS Code-fork 配置（extensions、workspaceStorage、settings.json 中的 IDE 设置）的场景。Keywords: copy, port, sync, migrate, compare, adapt.
---

# OpenCode 到 Antigravity Harness 迁移

这个 skill 用来把 OpenCode 作为源 harness，把 Antigravity 作为目标 harness。Antigravity 是基于 VS Code 的 fork，与 Codex / Claude Code 的命令行/CLI 模式有显著差异：它有完整的 IDE 配置（extensions、snippets、workspaceStorage、workspace trust）和 GUI 概念。

目标不是逐字复制配置文件，而是保持五层意图一致，并生成 Antigravity 能实际理解的规则、配置、skills、工具映射和差异清单。

> ⚠️ **Antigravity 加载机制未完全确认。** Antigravity 是否从 `~/.antigravity/AGENTS.md` 自动加载规则、是否支持 `~/.antigravity/skills/` 形式的本地 skill 发现、agent 集成是通过内置扩展还是其他机制——这些都需在新会话中运行时验证。涉及到位置不确定的字段，本 skill 一律标注 `needs-runtime-verification` 而非假定可用。

## 迁移范围

按五层处理：

1. Memory / Rules
   - 来源：`opencode-global-config/AGENTS.md`
   - 目标：`%USERPROFILE%\.antigravity\AGENTS.md`（位置待运行时确认；备选位置 `%APPDATA%\Antigravity\User\AGENTS.md`）
   - 处理方式：合并规则，不整文件覆盖；保留 Antigravity 已有规则（如有）。
2. Runtime Config
   - 来源：`opencode-global-config/opencode.json`、`opencode-global-config/tui.json`
   - 目标：`%APPDATA%\Antigravity\User\settings.json`（VS Code-style 配置）+ `%APPDATA%\Antigravity\User\keybindings.json`（如启用快捷键）
   - 处理方式：把 OpenCode 权限意图映射为 VS Code-style 设置 + `AGENTS.md` 文本规则；保留 Antigravity 现有 VS Code 设置（theme、language servers、editor 行为等）。
3. Skills
   - 来源：`opencode-global-config/skills/*/SKILL.md`
   - 目标：`%USERPROFILE%\.antigravity\skills\<skill-name>\SKILL.md`（位置待运行时确认）
   - 处理方式：只迁移用户自定义 skills；不复制 agent 专属 skills（如 `codex-*`、`claude-code-*`）。优先用 directory junction 链接到源；若 Antigravity 不识别 junction，回退实体拷贝并标注 `needs-manual-sync`。
4. MCP / Tools
   - 来源：`opencode.json` 里的 MCP 配置和 `opencode-global-config/mcp-scripts/**`
   - 目标：Antigravity 的 AI agent 集成机制（**待确认**：可能是内置 Gemini 扩展、独立的 MCP 服务器配置、或 VS Code Marketplace 上的 MCP 扩展）
   - 处理方式：先生成覆盖关系和缺口报告；不要假设 OpenCode MCP 等于 Antigravity 内置工具。所有 MCP server 默认标注 `needs-antigravity-mcp-adapter` 直到运行时确认。
5. Secrets / Accounts
   - 来源：MCP env 路径、OAuth token 路径、本地 `.my_secrets.env` / `.secrets.env`
   - 目标：Antigravity 扩展或运行时通过 `process.env` 引用本地 env 文件
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

### 2. 读取 Antigravity 目标现状

迁移前读取当前 Antigravity 目标文件：

- `%USERPROFILE%\.antigravity\AGENTS.md`（如存在）
- `%USERPROFILE%\.antigravity\argv.json`
- `%USERPROFILE%\.antigravity\extensions\extensions.json`（已安装扩展清单）
- `%USERPROFILE%\.antigravity\extensions\*`（实际扩展目录）
- `%APPDATA%\Antigravity\User\settings.json`
- `%APPDATA%\Antigravity\User\keybindings.json`（如存在）
- `%APPDATA%\Antigravity\User\snippets\*.json`（用户片段）
- `%APPDATA%\Antigravity\User\globalStorage\` 目录清单（不读 state.vscdb 内容，仅记录存在性）
- `%APPDATA%\Antigravity\User\workspaceStorage\` 目录清单（按 workspace UUID 记录）

把现有 Antigravity 配置视为用户资产，不视为可覆盖的生成物。

### 3. 保留 Antigravity 专属配置

如果存在，必须保留并在差异清单里列出：

- VS Code-style 设置：`workbench.colorTheme`、`editor.*`、`workbench.*`、language server 配置（如 `python.languageServer`）、`security.workspace.trust.*` 等
- `%USERPROFILE%\.antigravity\argv.json`（Antigravity/VS Code argv 覆盖，含 crash-reporter-id 等机器特定值）
- `%USERPROFILE%\.antigravity\extensions\` 下已安装的扩展目录
- `%APPDATA%\Antigravity\User\snippets\` 下的用户片段
- `%APPDATA%\Antigravity\User\globalStorage\` 中各扩展的本地存储
- `%APPDATA%\Antigravity\User\workspaceStorage\` 中各 workspace 的历史和状态
- 任何 Antigravity 内置 Gemini/AI 扩展的会话历史与配置（位置待运行时确认）

如果 OpenCode 规则更严格或更具体，把它追加到 Antigravity 说明里，不要删除 Antigravity 原有文本。

### 4. 生成 Antigravity Memory / Rules

把 OpenCode `AGENTS.md` 渲染为 Antigravity `AGENTS.md`：

- 保留中文优先交流规则。
- 保留当前 workspace 默认可编辑策略。
- 保留密钥文件读取顺序和禁止输出密钥规则。
- 保留浏览器登录规则：Google/OAuth 登录必须使用系统默认浏览器，不使用 Puppeteer 或自动化 Chromium。
- 保留高危命令确认策略。
- 增加简短来源说明，例如：`源自 OpenCode 全局 harness；保留 Antigravity 在 VS Code-fork settings.json 中的专属 IDE 配置、extensions、snippets、workspace trust 设置。`
- 顶部加 `needs-runtime-verification` 标注：Antigravity 是否从 `~/.antigravity/AGENTS.md` 自动加载规则尚未验证；若运行时确认从其他位置（如 `%APPDATA%/Antigravity/User/AGENTS.md`、`state.vscdb` 内字段、或扩展 UI）读规则，把本文件迁移过去。

不要删除 Antigravity 中已有但 OpenCode 没有的章节。

### 5. 生成 Antigravity Runtime Config

把 OpenCode 的运行时意图映射到 Antigravity：

- VS Code-style 权限：Antigravity 没有 Claude Code 那种 `permissions.allow/deny/ask` 的字符串数组语法。权限主要通过：
  - `security.workspace.trust.*`：工作区信任级别（控制是否允许执行 workspace tasks、运行扩展代码等）
  - `security.workspace.trust.untrustedFiles`：处理未信任文件的策略（`prompt` / `open` / `newWindow`）
  - 扩展级权限：每个扩展自身管理（如 Antigravity 内置 AI 扩展可能有自己的允许命令列表）
- 长期行为规则写进 `AGENTS.md`，不要试图在 `settings.json` 里复刻 Claude Code 的 allow/deny 数组。
- 保留 Antigravity 现有 VS Code 设置；新增设置时用 append-merge，不要覆盖整个 JSON。
- JSON 字符串里的 Windows 路径反斜杠必须双写：`%USERPROFILE%\\.secrets.env`；或统一使用正斜杠 `%USERPROFILE%/.secrets.env`，避免单反斜杠转义错误。
- 不要把 OpenCode TUI 快捷键强行写进 Antigravity，除非用户已在 `keybindings.json` 自定义。

向 `AGENTS.md` 增加内容时，按这些标题合并：

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
4. 只有用户批准后才复制到 Antigravity。
5. 如果 skill 依赖 OpenCode-only TUI API 或工具，标记为 `manual-review`，不要静默安装。
6. **优先使用 directory junction**：跨 agent 单一来源策略。`mklink /J %USERPROFILE%\.antigravity\skills\<name> D:\Code\opencode\opencode-global-config\skills\<name>` 。若 Antigravity 不跟随 junction（待运行时验证），回退到实体拷贝并加 `needs-manual-sync` 标记。

默认目标路径：

```text
%USERPROFILE%\.antigravity\skills\<skill-name>\SKILL.md
```

不要复制其他 agent 专属的 skills（如 `codex-*`、`claude-code-*`）。不要覆盖已有 Antigravity skills，除非用户批准。

### 7. 处理 MCP / Tools

Antigravity 是 VS Code-fork，其内置 AI 助手（Gemini）的 MCP/工具调用机制**与 Claude Code 和 Codex 都不同**：

- Antigravity 内置 AI 助手可能直接通过 Google 的 Gemini API 提供工具调用，而不是标准 MCP stdio 协议。
- 也可能通过 VS Code Marketplace 上的扩展提供 MCP 适配器（如 `@modelcontextprotocol/*` 系列）。
- 第三方扩展（如 GitHub Copilot Chat 模式、其他 AI 扩展）也可能各自有独立的工具机制。

因此：

- 保留 Antigravity 现有扩展和 AI 配置。
- 先把 OpenCode MCP server 转成覆盖关系报告。
- 所有 OpenCode MCP server 默认标注 `needs-antigravity-mcp-adapter`，直到运行时确认 Antigravity 的 MCP 接入路径。
- `gemini-search` 这类自定义 MCP 脚本，理论上可以直接在 Antigravity 中通过 Gemini API 原生 Google Search Grounding 实现（Antigravity 基于 Gemini，可能内置）；标注为 `covered-by-gemini-native`，并对比验证功能等价性。
- `puppeteer` / `gdrive` / `gmail` / `gcalendar`：检查 Marketplace 上是否有等价 VS Code 扩展或 MCP 适配器；标注为 `needs-marketplace-equivalent`。

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

- `experimental.disable_paste_summary = true`（Antigravity 无等价项；作为 portability note 记入 `AGENTS.md`）
- `permission.edit` 规则 → 转为 `AGENTS.md` 文本规则 + workspace trust 设置
- `read = allow` → Antigravity 默认允许，无需显式声明
- `bash` 默认 allow → AGENTS.md 文本规则；高危命令模式仍要求确认
- TUI 快捷键（`f4` 等）→ 可写入 `%APPDATA%\Antigravity\User\keybindings.json`（VS Code-style）

MCP / Tools：

- `puppeteer` → marketplace equivalent or extension
- `gdrive` → marketplace extension or Workspace integration
- `gmail` → marketplace extension
- `gcalendar` → marketplace extension
- `gemini-search` → 可能由 Gemini 原生 Search Grounding 覆盖

Skills：

- `skill-creator`
- `opencode-to-antigravity-harness`（本 skill）
- `antigravity-harness-backup-restore`
- `opencode-global-config/skills` 下未来新增的其他 agent-neutral 用户技能

## 当前 Antigravity 目标中要保留的内容

不要因为 OpenCode 没有等价项就删除这些内容：

- `%APPDATA%\Antigravity\User\settings.json` 中的所有 VS Code 设置（`workbench.colorTheme`、`editor.*`、`python.*`、`security.workspace.trust.*` 等）
- `%APPDATA%\Antigravity\User\keybindings.json` 中的自定义键位（如有）
- `%APPDATA%\Antigravity\User\snippets\*.json` 中的用户片段
- `%APPDATA%\Antigravity\User\globalStorage\` 中扩展的本地状态
- `%APPDATA%\Antigravity\User\workspaceStorage\` 中各 workspace 的历史
- `%USERPROFILE%\.antigravity\argv.json`（Antigravity argv 覆盖，含 crash-reporter-id）
- `%USERPROFILE%\.antigravity\extensions\` 下已安装的所有扩展
- Antigravity 内置 AI 扩展（Gemini）的本地缓存和会话历史

## OpenCode 到 Antigravity 转换说明

权限：

- OpenCode 在 JSON 里有结构化权限规则（`permission.edit`、`permission.bash` 等树形结构）。
- Antigravity 是 VS Code-fork，**没有 Claude Code 那种 allow/deny/ask 字符串数组语法**。权限主要靠：
  - `security.workspace.trust.*` 系列设置
  - 扩展级权限（Antigravity AI 扩展的内置允许/询问命令清单——位置待运行时确认）
  - `AGENTS.md` 文本规则提供给 AI 助手作行为指引
- 把 OpenCode 权限转换为 `AGENTS.md` 文本规则；不要试图在 VS Code-style `settings.json` 里复刻 allow/deny 数组。

MCP 与扩展：

- `gdrive` / `gmail` / `gcalendar`：搜索 VS Code Marketplace 上的 Google Workspace 扩展；标注 `needs-marketplace-equivalent`。
- `puppeteer`：标注 `needs-marketplace-equivalent`；Antigravity 可能有内置浏览器自动化能力（待确认）。
- `gemini-search`：标注 `covered-by-gemini-native`（Antigravity 基于 Gemini，可能原生支持 Search Grounding）；运行时确认后再决定是否需保留独立 MCP server。

Skills：

- 只复制用户自定义 skills。
- 跨 agent 通用 skill（如 `skill-creator`）通过 junction 链接到源。
- Antigravity 专属 skill（如 `antigravity-*`）只在 `~/.antigravity/skills/` 建 junction。
- 不复制其他 agent 专属 skills（`codex-*`、`claude-code-*`）。
- 如果某个 skill 引用了 `opencode-global-config` 这类 OpenCode-specific 路径，添加 portability note。

VS Code-fork 专属：

- `extensions/extensions.json` 记录已安装扩展清单；迁移到新机器时通过 `code --install-extension <id>` 重新安装。
- `argv.json` 中的 `crash-reporter-id` 是**机器特定**，不要跨机器复制。
- `globalStorage/state.vscdb` 是 SQLite 数据库，包含 prompt history、UI 状态等，跨机器迁移意义有限。
- `workspaceStorage/*` 含每个 workspace 的本地状态，跨机器迁移意义有限。

Secrets：

- 可以列出 `%USERPROFILE%/.my_secrets.env`、`%USERPROFILE%/.secrets.env`、OAuth token 文件路径和 credential 文件路径。
- JSON 字符串里 Windows 路径必须用双反斜杠或正斜杠，单反斜杠会触发 JSON 转义错误。
- 禁止输出 token 内容、API key 值、refresh token 或 client secret。
- 禁止把 credential 文件复制进生成文件或仓库。

## 差异清单

应用前 dry-run 或应用后必须输出差异清单，包含：

- Antigravity 中保留：目标原本已有、继续保留的规则和配置。
- 从 OpenCode 新增：迁移后新增到 Antigravity 的规则、配置或 skill。
- OpenCode 专属 / 需要人工审阅：无法直接映射的 TUI、MCP 或路径。
- Antigravity 专属 / 不要删除：VS Code 设置、extensions、snippets、workspace trust、argv.json、globalStorage、workspaceStorage、内置 Gemini 扩展状态。
- 密钥引用：只列路径，不列值。
- 下一步：需要用户确认、重新授权或手动验证的事项。
- `needs-runtime-verification` 项清单：所有不确定的字段位置和加载机制（AGENTS.md 位置、skills 目录、MCP 接入路径等）。

重点关注"Antigravity 专属 / 不要删除"和 `needs-runtime-verification`，因为 Antigravity 作为 VS Code-fork 比 Codex/Claude Code 有显著更多的 IDE 资产，且许多关键机制（agent 集成、MCP 接入）尚未在运行时验证。

## 安全应用

只有用户批准后才执行写入：

1. 带时间戳备份目标文件。
2. 增量写入变更。
3. 验证 JSON 和 skill frontmatter。
4. 检查 `settings.json` 中字符串字段不存在非法转义，例如 `\.`、`\U`、`\a` 这类未转义 Windows 路径片段。
5. 重新读取目标文件，确认应保留章节仍存在。
6. 报告准确改动路径。
7. 列出所有 `needs-runtime-verification` 项，提醒用户在新会话中验证。

如果验证失败，停止并说明问题。只有用户确认后才从备份恢复。

## 安全规则

- 不输出密钥值。
- 不提交 token 或 credential 文件。
- 不整文件覆盖 Antigravity `settings.json` 或 `AGENTS.md`。
- 不为了匹配 OpenCode 而删除 Antigravity 现有 VS Code 设置、extensions、snippets、workspace trust 或 globalStorage 状态。
- 不假设 OpenCode MCP 等于 Antigravity 内置工具或扩展。必须报告覆盖关系和缺口。
- 未在目标环境列出或调用成功前，不声称某个已迁移 MCP 可用。
- 不假定 Antigravity 加载 `~/.antigravity/AGENTS.md`、`~/.antigravity/skills/`、`~/.antigravity/keybindings.json` 等位置——所有未验证项标注 `needs-runtime-verification`。

## 示例

用户："把 OpenCode 的 harness 同步到 Antigravity，规则本质一致，差异列出来。"

处理方式：

1. 读取 OpenCode 和 Antigravity 源文件。
2. 生成五层映射说明。
3. 列出 Antigravity-only 项，例如 VS Code 设置、扩展清单、snippets、workspace trust、argv.json、内置 Gemini 扩展状态。
4. 列出所有 `needs-runtime-verification` 项（AGENTS.md 加载位置、skills 目录、MCP 接入路径等）。
5. 展示 dry-run 变更。
6. 写入 `%USERPROFILE%\.antigravity` 和 `%APPDATA%\Antigravity\User` 前征得用户确认。
7. 完成后提示用户：启动新 Antigravity 会话，逐项验证 `needs-runtime-verification` 列表，确认每个未验证机制的实际位置/可用性。
