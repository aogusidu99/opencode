# 多 Agent Harness 管理与同步架构 (Multi-Agent Harness Architecture)

> 最后更新：2026-05-17
> 状态：working（已知漏洞见第 9 节）
>
> **本文件是跨 agent harness 架构的"组织文件"**：记录设计意图、文件位置、同步机制、meta-rules、未解决的漏洞与决策日志。规则文本本身不在这里——分别在各 agent 的 AGENTS.md / CLAUDE.md 中维护。

---

## 1. 目标与范围 (Goal & Scope)

让 4 个 AI 编程 agent 共享一套"高度定制化的 harness"——使用相同的行为规则、相同的密钥处理策略、相同的 skills 工具箱，最大化跨 agent 一致性，最小化迁移成本。

涉及的 4 个 agent：

| Agent | 形态 | 厂商 |
|-------|------|------|
| **OpenCode** | TUI/CLI（Bun + TypeScript） | 开源（sst.dev） |
| **Codex** | CLI（Rust） | OpenAI |
| **Claude Code** | CLI + Desktop | Anthropic |
| **Antigravity** | VS Code-fork（Electron） | Google（基于 Gemini） |

**不在范围**：通用 IDE 插件（如 Continue、Cursor 本身、GitHub Copilot Chat 等）。

---

## 2. 五层 Harness 模型 (Five-Layer Model)

跨 agent 的语义共享按以下 5 层划分。任何迁移、备份、同步操作都按这 5 层组织：

| 层 | 内容 | 表现形式 |
|----|------|---------|
| **1. Memory / Rules** | 行为规则（中文优先、密钥不输出、外部文件确认、高危确认） | Markdown：`AGENTS.md` / `CLAUDE.md` |
| **2. Runtime Config** | 权限矩阵、experimental 字段、MCP 服务器、hooks 等 | JSON/TOML：`opencode.json` / `config.toml` / `settings.json` |
| **3. Skills** | 可复用的工作流（如 backup、migration、skill-creator） | 目录：`SKILL.md` + 脚本 + templates |
| **4. MCP / Tools** | 第三方工具集成（puppeteer、gdrive、gmail、gcalendar、gemini-search 等） | MCP server 配置（嵌入 Runtime Config 或独立 `.mcp.json`） |
| **5. Secrets / Accounts** | API key、OAuth token、credential 文件 | **不进 harness**：仅记录路径引用，实际值从本机密钥文件读取 |

> **核心原则**：跨 agent 迁移/备份不复制 token 与密钥内容；只迁移规则、配置、skills 与路径引用。

---

## 3. 单一来源结构 (Single Source of Truth)

**物理位置**：`D:/Code/opencode/opencode-global-config/`

```
opencode-global-config/
├── AGENTS.md                                    ← OpenCode 全局规则源 + 跨 agent 共享文本权威版
├── opencode.json                                 ← OpenCode 运行时配置源
├── mcp-scripts/                                  ← 自定义 MCP server 脚本（gemini-search、gdrive-oauth 等）
├── skills/                                       ← Skills 单一来源（7 个）
│   ├── skill-creator                              ← agent-neutral
│   ├── opencode-to-codex-harness                  ← Codex 专属（迁移）
│   ├── codex-harness-backup-restore               ← Codex 专属（备份）
│   ├── opencode-to-claude-code-harness            ← Claude Code 专属（迁移）
│   ├── claude-code-harness-backup-restore         ← Claude Code 专属（备份）
│   ├── opencode-to-antigravity-harness            ← Antigravity 专属（迁移）
│   └── antigravity-harness-backup-restore         ← Antigravity 专属（备份）
├── harness-backups/                              ← 备份快照仓库
│   ├── codex/
│   ├── claude-code/
│   └── antigravity/                               ← 待启用
└── HARNESS-ARCHITECTURE.md                       ← 本文档
```

---

## 4. 同步机制（两类，差异关键）(Sync Mechanisms — Two Types)

### 4.1 Skills 层：真同步（Windows directory junction）

```
opencode-global-config/skills/skill-creator/              ← 源
    ↑ junction
~/.codex/skills/skill-creator                              ← Codex 链接
~/.claude/skills/skill-creator                             ← Claude Code 链接
~/.antigravity/skills/skill-creator (待建)                 ← Antigravity 链接
```

**性质**：单一物理文件，多入口访问。编辑源即对所有 agent **立即生效**，零 drift。

**创建命令**：

```powershell
cmd /c mklink /J "<agent-skills-dir>\<skill-name>" "D:\Code\opencode\opencode-global-config\skills\<skill-name>"
```

**链接分布**（agent 专属 skill 只在对应 agent 建 junction）：

| Skill | OpenCode | Codex | Claude Code | Antigravity |
|-------|----------|-------|-------------|-------------|
| skill-creator | ✅ 直接读源 | 🔗 junction | 🔗 junction | （待建） |
| opencode-to-codex-harness | ✅ | 🔗 | ❌ | ❌ |
| codex-harness-backup-restore | ✅ | 🔗 | ❌ | ❌ |
| opencode-to-claude-code-harness | ✅ | ❌ | 🔗 | ❌ |
| claude-code-harness-backup-restore | ✅ | ❌ | 🔗 | ❌ |
| opencode-to-antigravity-harness | ✅ | ❌ | ❌ | （待建） |
| antigravity-harness-backup-restore | ✅ | ❌ | ❌ | （待建） |

**例外（实体目录保留）**：
- `~/.codex/skills/.system/` — Codex 系统 skill
- `~/.codex/skills/login-secrets/` — Codex 登录态 skill

### 4.2 Rules 层：人工 4-way 同步（meta-rule 强制）

4 个独立文件，每次共享章节改动必须 4 个都更新：

| Agent | 文件路径 | 类型 | 大小（约） |
|-------|---------|------|-----------|
| OpenCode | `D:/Code/opencode/opencode-global-config/AGENTS.md` | 普通文件 | 7 KB |
| Codex | `~/.codex/AGENTS.md` | 普通文件 | 9 KB |
| Claude Code | `~/.claude/CLAUDE.md` | 普通文件 | 10 KB |
| Antigravity | `~/.antigravity/AGENTS.md` | 普通文件 | 8 KB |

**为何不用 junction**：
1. **文件名不同**：Claude Code 期望 `CLAUDE.md`，其他 3 个用 `AGENTS.md`；junction 是目录级，文件需用 symlink，且 Windows file symlink 要管理员权限。
2. **内容必须有差异**：每个 agent 有专属尾段（hooks / sandbox_mode / experimental 字段 / VS Code-fork 设置等），无法整文件统一。
3. **核心 5 章节文本一致**，但末尾有 agent-specific 章节。

**共享章节**（4 份必须一致）：
- 本地文件策略
- 密钥管理
- 浏览器操作规范
- 工具与命令权限策略
- 交流规范
- Skills 维护策略
- Harness 规则跨 agent 同步策略（meta-rule）

**Agent 专属章节**（不需同步）：
- OpenCode: `experimental.disable_paste_summary` parity notes、TUI 快捷键
- Codex: `OpenCode Harness 同步说明`
- Claude Code: `OpenCode parity notes`、`Claude Code 专属配置（不要删除）`、`additionalDirectories + allow 双层`说明
- Antigravity: VS Code-fork 提示、`needs-runtime-verification` 标注

---

## 5. 全局级文件映射 (Global-Level File Map)

| Layer | OpenCode | Codex | Claude Code | Antigravity |
|-------|----------|-------|-------------|-------------|
| **Rules** | `opencode-global-config/AGENTS.md` | `~/.codex/AGENTS.md` | `~/.claude/CLAUDE.md` | `~/.antigravity/AGENTS.md` ⚠️ |
| **Runtime config** | `opencode-global-config/opencode.json` | `~/.codex/config.toml` | `~/.claude/settings.json` | `%APPDATA%/Antigravity/User/settings.json` ⚠️ |
| **Skills dir** | `opencode-global-config/skills/` (源) | `~/.codex/skills/` | `~/.claude/skills/` | `~/.antigravity/skills/` ⚠️ |
| **Keybindings** | (TUI 内置) | (无独立文件) | `~/.claude/keybindings.json` | `%APPDATA%/Antigravity/User/keybindings.json` |
| **Subagents** | `.opencode/agent/` (项目级) | — | `~/.claude/agents/` (用户级) | (VS Code 扩展) |
| **Slash Commands** | `.opencode/command/` | — | `~/.claude/commands/` | (VS Code commands) |
| **Plugins** | `.opencode/plugins/` | `~/.codex/plugins/` (marketplace) | `~/.claude/plugins/` (marketplace) | `~/.antigravity/extensions/` (VS Code 扩展) |
| **MCP servers** | `opencode.json` 的 `mcp` 字段 | `config.toml` 的 plugin/connector 等价物 | `settings.json` 的 `mcpServers` | TBD ⚠️（可能 Gemini 原生 / Marketplace） |
| **Workspace boundary** | `permission.external_directory` | `[projects.*]` trusted | `permissions.additionalDirectories` | `security.workspace.trust.*` |

⚠️ = `needs-runtime-verification`（加载位置或机制未在运行时确认）

---

## 6. 项目级文件映射 (Project-Level File Map)

| Agent | 项目规则 | 项目配置 | 项目自定义资产 |
|-------|---------|---------|---------------|
| OpenCode | `<project>/AGENTS.md` ✅ | `<project>/.opencode/opencode.json` | `<project>/.opencode/{agent,command,skills,plugins,themes,glossary}/` |
| Codex | `<project>/AGENTS.md` ✅ | (通常无项目级) | — |
| Claude Code | `<project>/CLAUDE.md`（主，需 `@AGENTS.md` import 引入 AGENTS.md） | `<project>/.claude/settings.json` + `settings.local.json` | `<project>/.claude/{agents,commands,skills}/` |
| Antigravity | `<project>/AGENTS.md` ✅（待验证） | `<project>/.vscode/settings.json` | `<project>/.vscode/` |

**项目规则的开放标准**：[agents.md](https://agents.md/) — OpenCode/Codex/Antigravity 都直接读 `<project>/AGENTS.md`，**只有 Claude Code 是例外**（原生不读 AGENTS.md，但 CLAUDE.md 可用 `@AGENTS.md` 显式 import）。

**Claude Code 的"自动 import AGENTS.md"方案被否决**（用户 2026-05-17 决定）：
- 不在 `~/.claude/CLAUDE.md` 全局 hook 项目 AGENTS.md（`@AGENTS.md` import 相对解析到家目录，不是项目 cwd）
- 未来按项目实际需要时再处理（建项目 CLAUDE.md 含 `@AGENTS.md`，或写 SessionStart hook）

---

## 7. 已建立的 Meta-Rules

3 条 meta-rule 已写入 4 个 agent 的规则文件（OpenCode AGENTS.md、Codex AGENTS.md、Claude Code CLAUDE.md、Antigravity AGENTS.md）：

### 7.1 Skills 维护策略 (Skills Maintenance Policy)

- 源：`opencode-global-config/skills/`
- 各 agent 用 junction 链接（OpenCode 直接读源）
- 新增 skill：创建源 SKILL.md → 为需要的 agent 建 junction
- 删除 skill：先 `rmdir <link>` 移 junction，再删源
- agent 专属系统目录保留实体（Codex 的 `.system/`、`login-secrets/`）

### 7.2 Harness 规则跨 agent 同步策略 (Cross-Agent Rule Sync Policy)

- 规则文件（5 章共享章节）每次改动**默认同步 4 个文件**
- 例外：各 agent 自身运行时配置不强制同步（按各自机制）
- 执行流程：先告知触及哪几个文件 → 同步写入 → 报告 4 个 ✅ → 拍备份快照

### 7.3 Claude Code 权限双层机制（仅 CLAUDE.md）

- `permissions.additionalDirectories`（工作目录边界白名单，先检查）
- `permissions.allow / deny / ask`（工具+路径匹配，后检查）
- 二者缺一不可——只配 allow 不配 additionalDirectories，会被边界拦截弹"Path is outside allowed working directories"

---

## 8. 备份与还原架构 (Backup & Restore)

### 8.1 快照位置

```
opencode-global-config/harness-backups/
├── codex/<snapshot-id>/                    ← Codex 快照
├── claude-code/<snapshot-id>/               ← Claude Code 快照
└── antigravity/<snapshot-id>/              ← Antigravity 快照（待启用）
```

### 8.2 快照三件套（每个版本）

| 文件 | 用途 |
|------|------|
| `<snapshot-id>.zip` | 压缩包（含 manifest + RESTORE + 内容） |
| `<snapshot-id>.zip.sha256` | 校验和 |
| `<snapshot-id>.RESTORE.md` | 独立还原说明（不解压即可阅读） |

### 8.3 默认 Drive 上传文件夹

```
https://drive.google.com/drive/folders/10-YC5YN9j3jdJBcyQOegPQhv5sTcCq1F
```

按各 agent 的 backup-restore skill 规定，"备份"操作默认上传三件套到该文件夹，无需二次确认。

### 8.4 脚本状态

| Agent | Backup 脚本 | Restore 脚本 | Upload 脚本 |
|-------|------------|--------------|------------|
| Codex | ✅ `Backup-CodexHarness.ps1` | ✅ `Restore-CodexHarness.ps1` | ✅ `Upload-CodexHarnessArchiveToDrive.ps1` |
| Claude Code | ❌ 未移植 | ❌ 未移植 | （复用 Codex 版，agent-neutral） |
| Antigravity | ❌ 未移植 | ❌ 未移植 | （复用 Codex 版） |

**临时方案**：Claude Code/Antigravity 备份用手写 PowerShell 流程（参照各自 `*-harness-backup-restore/SKILL.md` 规格）。

---

## 9. 已知漏洞与待完善项 (Known Gaps)

按风险等级排序：

| # | 漏洞 | 风险等级 | 计划 |
|---|------|--------|------|
| 1 | Rules 4 份独立拷贝，靠 meta-rule 人工同步 | 🟡 中（drift 风险） | 短期：保持现状；长期：可加 git pre-commit hook 校验 5 章共享章节 |
| 2 | Antigravity 加载 `~/.antigravity/AGENTS.md` 未运行时验证 | 🟡 中 | 启动 Antigravity 实测；不行则迁移到正确位置（可能 `%APPDATA%/Antigravity/User/`） |
| 3 | Antigravity skill 发现机制未验证（`~/.antigravity/skills/`） | 🟡 中 | 启动 Antigravity 实测；不行则切实体拷贝并加 `needs-manual-sync` |
| 4 | Claude Code skill 发现机制未完全验证（`~/.claude/skills/` 是否被自动加载） | 🟡 中 | 重启 Claude Code 后查 `/skill` 或可用 skills 列表 |
| 5 | Antigravity 内置 AI 助手的 MCP 接入路径未知 | 🟡 中 | 实测 Antigravity 内置 Gemini 是否支持 MCP；不行用 Marketplace 扩展或 Gemini 原生 Search Grounding |
| 6 | Claude Code/Antigravity 备份脚本未从 Codex 版移植 | 🟢 低（手写流程已跑通） | 抽空 port，参照 `*-harness-backup-restore/SKILL.md` 规格 |
| 7 | 项目级 CLAUDE.md 自动 import AGENTS.md（全局 hook 方案） | 🟢 低（已主动否决，按需手工建） | — |
| 8 | 各 agent 运行时配置（settings.json / config.toml / opencode.json）的同步语义对齐没有 lint | 🟢 低 | 长期：写一个 cross-agent-config-checker 脚本 |
| 9 | `crash-reporter-id`、`installation_id` 等机器特定字段在跨设备还原时的处理 | 🟢 低 | 各 backup-restore skill 已标注；脚本移植时实现保留逻辑 |
| 10 | OAuth token 跨设备如何重新授权——目前要求手动重做 | 🔵 不可消除 | 安全策略要求，无解 |

---

## 10. 决策日志 (Decision Log)

按时间倒序：

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-05-17 | 不实现 Claude Code 全局 `@AGENTS.md` import | 路径相对解析问题，未来按项目手工处理 |
| 2026-05-17 | 项目级跨 agent 规则采用 `<project>/AGENTS.md` 开放标准 | 4 agent 中 3 个原生支持；Claude Code 项目 CLAUDE.md 含 `@AGENTS.md` import |
| 2026-05-17 | Rules 文件保持 4 份拷贝 + meta-rule 同步 | 选择 vs symlink/构建脚本/hook 校验中的最低成本方案 |
| 2026-05-17 | 写入"Harness 规则跨 agent 同步策略"meta-rule 到 4 个文件 | 强制纪律 |
| 2026-05-17 | Skills 全部改 junction 架构（Codex 拷贝改 junction） | 消除 drift；diff 确认 Codex 拷贝与源字节级一致后无损切换 |
| 2026-05-17 | 7 个 skill 全部写入 `opencode-global-config/skills/` | 单一来源，跨 agent 共享 |
| 2026-05-17 | Antigravity 加 `~/.antigravity/AGENTS.md`（位置 best-guess） | 跟随 Codex `~/.codex/AGENTS.md` 模式，待运行时验证 |
| 2026-05-17 | Claude Code 加 `permissions.additionalDirectories` + 可信路径 allow | 解决"Path is outside allowed working directories"反复弹窗 |
| 2026-05-17 | 默认上传 Drive 文件夹 `10-YC5YN9j3jdJBcyQOegPQhv5sTcCq1F` | 用户指定的统一备份位置 |
| 2026-05-17 | 备份/还原 5 层模型；secrets 仅记录路径，不打包值 | 跨设备迁移时不泄露凭据 |

---

## 11. 维护本文档 (Maintaining This Document)

- 任何 harness 架构调整后，更新对应章节（特别是第 5、6 节文件映射）
- 每次解决一项漏洞，在第 9 节标记完成并迁移到第 10 节决策日志
- 新增决策时写入第 10 节，**永不删除**——历史决策保留作上下文
- 本文件**不计入**跨 agent 4-way 同步——它是元文档，只在 `opencode-global-config/` 维护一份
- 但本文件**应被备份**——纳入下次 backup 快照时包含
