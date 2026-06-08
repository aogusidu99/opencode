# 全局规则

## 本地文件策略 (Local File Policy)

- 文件编辑和修改的默认目录是 opencode 中当前打开的文件夹。
- 当前打开的文件夹下的文件可以直接进行编辑，无需询问。
- 在编辑或修改当前打开的文件夹以外的文件之前，请先询问用户进行确认。**例外：以下"可信工作域"路径属于用户日常配置范围，写入无需逐次询问**：
  - `D:/Code/opencode/**` — OpenCode 仓库本体
  - `D:/Code/Harness Universal/**` — 跨 agent harness 共享仓库（skills 源、备份快照）
  - `C:/Users/aogus/.claude/**` — Claude Code home
  - `C:/Users/aogus/.codex/**` — Codex home
  - `C:/Users/aogus/.antigravity/**` — Antigravity home
  - `C:/Users/aogus/.config/**` — MCP 服务器和工具的配置目录
- 上述例外**不覆盖**安全规则：`.env*`、`.git/**`、`*.lock` 仍然禁止；`rm -rf` / `sudo` / 生产部署仍需确认。
- 读取或查看文件通常不需要用户确认。

## 密钥管理 (Secrets Management)

- 如果需要账户、密码或 API Key 信息，请自动静默读取 `C:\Users\aogus\.my_secrets.env` 文件。
- 绝对不能将该文件中的任何密钥、密码内容输出到对话中，也不能提交到代码库。
- 读取后直接使用，无需告知用户具体值。

## 浏览器操作规范 (Browser Operations)

- 凡是需要用户登录 Google 账号的操作（OAuth 授权、API 启用等），**禁止使用 Puppeteer**，必须用 `Start-Process` 打开系统默认浏览器。
- 原因：Puppeteer 启动的 Chromium 会被 Google 识别为不安全的自动化浏览器（`navigator.webdriver=true`、无登录 Cookie、指纹异常），导致登录被拦截。系统默认浏览器已有 Google 登录会话和信任记录，可以直接完成授权。
- 正确写法：`Start-Process "https://..."`
- Puppeteer 仅用于不需要 Google 登录的页面自动化操作。

## 工具与命令权限策略 (Tool & Command Permissions)

- 除高危或生产相关命令外，其他 bash/shell 命令默认直接运行。
- 每次都必须手动确认：`rm -rf` / `rm -fr` / PowerShell `Remove-Item -Recurse -Force` 等高危递归删除，尤其是项目根目录以外或 `.git` 目录相关删除。
- 每次都必须手动确认：任何 `sudo` 命令。
- 当用户要求“提交代码”“提交并合并”“提交代码并推送”等 git 交付动作时，默认包含 `git push` 到当前或目标远端分支，无需再次确认。
- 除非用户明确要求提交或推送（例如“提交代码”“提交并合并”“提交代码并推送”，或给出明确 git commit / git push 命令），不要主动执行 git commit、git push 或向 GitHub 发布代码。
- 每次都必须手动确认：生产环境部署与发布命令，例如 `npm publish`、`docker push`。
- 每次都必须手动确认：任何命令文本中包含 `deploy`、`prod`，或涉及云端/生产凭据的命令，例如 `aws`、`vercel`。
- 以下工具默认允许：`glob`、`grep`、`list`、`task`、`webfetch`、`websearch`、文件读写（`read`、`edit`、`write`）。
- 对于只读检查、项目验证、测试、类型检查、代码搜索、状态查看等低风险命令，agent 默认可以直接运行，无需逐次询问用户。例如：`git status`、`bun typecheck`、`bun test`、`bun dev`、`pnpm test`、`pnpm build`、`rg`、`ls`、`pwd`。
- 运行上述命令的目的，是让桌面版协作也具备 CLI 的可复现、可验证、可审计优势。
- 如果命令失败，agent 应优先自行阅读错误、定位原因并继续修复；只有在需要用户提供账号、密钥、外部权限、业务决策或不可逆操作确认时，才暂停询问用户。
- 全局禁止编辑/写入：`.env*` 文件、`.git/` 目录、lock 文件（`*lock*`、`pnpm-lock.yaml`）。
- `external_directory` 默认允许读取/访问；写入外部目录仍遵守本地文件策略和系统权限限制。
- **Agent harness 敏感文件：** `CLAUDE.md`、`AGENTS.md`、`settings.json`、`settings.local.json`、`config.toml`、`opencode.json` 等指令/权限配置文件，各 agent 的 harness 层可能强制每次编辑需用户确认（不可绕过）。跨 agent 规则同步时应批量完成，减少确认次数。

## 桌面版协作与 CLI 验收策略 (Desktop Agent with CLI Verification)

用户可以主要通过桌面版界面与 agent 协作，但 agent 在执行开发、修改、验证、排错任务时，应尽量使用明确、可复现的 CLI 命令完成关键步骤。

目标不是要求用户亲自使用 CLI，而是让桌面版也获得 CLI 的核心优势：

- 操作可复现
- 结果可验证
- 过程可审计
- 错误可定位
- 改动范围可追踪

### 默认工作方式

当用户提出修改、修复、实现、排错、重构等任务时，agent 应默认完成以下流程：

1. 理解任务和当前项目状态
2. 阅读相关文件和现有规则
3. 修改必要文件
4. 使用项目约定命令进行验证
5. 如果验证失败，继续修复并重新验证
6. 最后汇报修改内容、验证结果和剩余风险

除非用户明确要求只分析、不修改，否则 agent 不应停留在建议层面。

### CLI 验收要求

每次完成代码相关修改后，agent 应尽量运行相关验证命令。

OpenCode 项目中优先使用以下命令：

```powershell
git status
```

用于确认修改了哪些文件。

```powershell
bun typecheck
```

用于检查类型错误。运行目录应为相关包目录，例如 `packages/opencode`，不要直接运行 `tsc`。

```powershell
bun test
```

用于运行相关测试。运行目录应为相关包目录，避免在仓库根目录运行测试。

```powershell
bun dev
```

用于在需要时启动本地项目并检查运行状态。

如果当前任务只影响文档、配置说明或非代码内容，可以不运行完整测试，但应说明没有运行的原因。

### 桌面版结果汇报

agent 完成任务后，应向用户汇报：

- 改了哪些文件
- 做了什么修改
- 运行了哪些验证命令
- 每个命令是否通过
- 如果没有运行某个验证命令，说明原因
- 是否还有需要用户注意的风险

不要只说：

```text
我检查过了。
```

应说明：

```text
我运行了 bun typecheck，结果通过。
```

如果命令失败，应总结关键错误，而不是粘贴大量无关日志。

### 排错要求

如果验证命令失败，agent 不应只把错误丢给用户，而应先尝试自行定位和修复。

排错时应优先关注：

- 报错文件和行号
- 最近修改过的代码
- 缺失依赖
- 配置错误
- 测试断言失败
- 环境变量缺失
- 端口占用

如果失败原因需要用户提供账号、密钥、外部权限或业务决策，agent 应明确说明卡点。

### 用户侧使用约定

用户不需要亲自记住所有 CLI 命令。

agent 应负责选择和运行命令，并用简洁语言解释结果。

用户只需要理解几个核心判断：

- 类型检查是否通过
- 测试是否通过
- 改了哪些文件
- 是否还有风险

用户可以直接提出：

```text
帮我实现这个功能，完成后运行类型检查和测试。
```

或：

```text
修复这个问题，直到 bun test 通过。
```

agent 应把 CLI 结果转化为用户能理解的结论。

## 交流规范 (Communication)

1. 优先使用中文进行交流。
2. 优先给出 PowerShell 中的命令并运行；在桌面版协作中，agent 应主动承担命令执行、验证和排错工作，而不是要求用户手动操作。
3. 重要的、本次会话前面没有出现过的代码和命令，请给出解释说明。
4. 优先使用 pnpm/bun 而非 npm。
5. 生成主要代码时加注释，解释代码的作用。
6. 任务完成汇报应包含实际验证结果，尤其是 `git status`、类型检查、测试或未运行原因。

## Skills 维护策略 (Skills Maintenance Policy)

Skills 分两类：

**共享 Skills（junction 同源）：** 源在 `D:/Code/Harness Universal/skills/`，各 agent 通过 junction 链接，编辑源即对所有 agent 立即生效。由 git 管理，不在备份范围内。

共享 skills：`skill-creator`、`login-secrets`、`project-agent-rule-sync`、`harness-global-rule-sync`

**专属 Skills（entity，各 agent 独立）：** 存放在各 agent 自己的 skills 目录中，作为实体目录。由各 agent 的 `*-harness-backup-restore` skill 备份。

| Agent | 专属 entity skills |
|-------|-------------------|
| Claude Code | `claude-code-harness-backup-restore` |
| Codex | `codex-harness-backup-restore`、`.system` |
| OpenCode | `opencode-harness-backup-restore` |
| Antigravity | `antigravity-harness-backup-restore` |

| Agent | 本地 skills 目录 | 链接方式 |
|-------|-----------------|---------|
| OpenCode | `~/.config/opencode/skills/<name>` | junction（共享）+ entity（专属）|
| Codex | `~/.codex/skills/<name>` | junction（共享）+ entity（专属）|
| Claude Code | `~/.claude/skills/<name>` | junction（共享）+ entity（专属）|
| Antigravity | `~/.antigravity/skills/<name>` | junction（共享）+ entity（专属）|

## 项目级规则与项目级 Skills (Project-Level Rules and Skills)

- 对话涉及项目级规则、项目 `AGENTS.md`/`CLAUDE.md`、项目 `.agents/skills` 或项目级 skill 变更时，优先使用 `project-agent-rule-sync` skill。
- 对话涉及全局 harness 规则、跨 agent 规则、共享 skills、junction、缺失 skill 或全局规则/skill 一致性时，优先使用 `harness-global-rule-sync` skill。
- 当用户要求新增或修改项目级规则，并且没有明确限定某一个 agent 时，默认在同一项目目录中同时维护内容等价的 `AGENTS.md` 与 `CLAUDE.md`，以便 Codex/OpenCode/Antigravity 与 Claude Code 都能读取项目级规则。
- 项目级规则文件使用标准大写文件名：`AGENTS.md`、`CLAUDE.md`。不要新建或依赖 `agent.md`、`claude.md` 等非标准文件名，除非用户明确要求或对应 agent 已配置 fallback。
- 同一目录下的 `AGENTS.md` 与 `CLAUDE.md` 应保持核心规则一致；只允许保留与特定 agent 加载机制、命令格式或工具能力相关的少量差异。
- 当用户要求新增或修改项目级 skill，并且希望不同 agent 尽量复用时，优先放在项目目录的 `.agents/skills/<skill-name>/SKILL.md`，并在同目录的 `AGENTS.md` 与 `CLAUDE.md` 中简要说明该 skill 的用途和位置。
- 不要把完整 skill 内容复制进 `AGENTS.md` 或 `CLAUDE.md`；规则文件只放触发说明和约定，具体 workflow 保持在 `SKILL.md` 中。
- 若某个 agent 不支持项目级 `.agents/skills` 自动扫描，则按该 agent 的本地 skills 机制建立链接或同步副本；长期跨项目共享的 skill 仍优先维护在 `D:/Code/Harness Universal/skills/` 并通过 junction 分发。

## Junction 与非 Junction 配置编辑策略 (Junction vs Non-Junction Edit Policy)

**Junction 文件（Skills）：** 源存放于 `D:/Code/Harness Universal/skills/`，各 agent 通过 junction 链接。**编辑一次，所有 agent 立即生效**——无需逐 agent 同步。

**非 Junction 文件（规则、运行时配置）：** 各 agent 各有独立的本地文件，内容因 agent 特性而异。**调整配置时，需根据用户本意分别修改对应 agent 的配置文件**：

| 文件类型 | Claude Code | Codex | OpenCode | Antigravity |
|---------|-------------|-------|----------|-------------|
| 规则 | `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` | `opencode-global-config/AGENTS.md` | `~/.antigravity/AGENTS.md` |
| 运行时 | `~/.claude/settings.json` | `~/.codex/config.toml` | `opencode.json` | `%APPDATA%/Antigravity/User/settings.json` |

**备份策略：** 非 junction 文件由各 agent 的 `*-harness-backup-restore` skill 备份到 `D:/Code/Harness Universal/harness-backups/<agent>/`。Junction'd skills 由 git 管理，不在备份范围内。

## Harness 规则跨 agent 同步策略 (Cross-Agent Rule Sync Policy)

凡是涉及 agent harness 的全局规则调整，默认同步更新到全部 4 个 agent 的规则文件及跨 agent 参考文档：

- `~/.claude/CLAUDE.md`（Claude Code）
- `~/.codex/AGENTS.md`（Codex）
- `D:/Code/opencode/opencode-global-config/AGENTS.md`（OpenCode）
- `~/.antigravity/AGENTS.md`（Antigravity）
- `D:/Code/Harness Universal/AGENTS.md`（跨 agent 参考文档）

仅在该 agent 自身运行时配置中表达的设置不强制跨 agent 同步。
