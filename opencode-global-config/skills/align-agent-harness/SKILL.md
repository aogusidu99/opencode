---
name: align-agent-harness
description: 按 Harness Universal 项目的 A/B/C 类规则配置、对齐或审计某个 agent（Claude Code / Codex / OpenCode 定制版 / Antigravity）的 harness，并把全局规则变更同步到全部 agent。用户要求“按本项目规则配置 agent harness”“检查/对齐 N 个 agent 的 harness 是否一致”“同步 harness 规则到所有 agent”“新接入一个 agent 的 harness”“审计 harness 与参考文档的差异”时使用。Keywords: harness, align, audit, AB-class, cross-agent sync, agent config.
---

# 按本项目规则配置 agent harness

把 `D:/Code/Harness Universal` 的 A/B/C 类规则落到某个 agent 的真实 harness 文件上：配置新接入的 agent、对齐已有 agent、或审计四个 agent 与参考文档的一致性。目标是让每个 agent 的**规则文件 + 运行时配置 + skills** 表达同一套统一意图；发现不一致时，要么修实现、要么修文档，并说明为什么不一致。

不要凭记忆改 harness。每次都先读当前权威来源，因为 references、matrix 和各 agent 实现会持续演进。

## 权威来源（按固定顺序先读）

1. `AGENTS.md` — 项目级 bootstrap 和不可降级安全底线。
2. `README.md` — 当前结构、A/B/C 分类、维护流程（冲突时以 README 的结构口径为准）。
3. `B-INTENT-IMPLEMENTATION-MATRIX.md` — 每条 B 类意图 → 各 agent 实现文件 + 验证方式。
4. `references/*.md` 和 `references/skills/*.md` — 每条统一意图的语义母版。
5. 目标 agent 的真实实现文件（见下表）。

语义以对应 reference 为准；当前仓库结构和最终口径以 README 为准。

## A / B / C 分类

| 类 | 判定 | 处理 |
|----|------|------|
| A | 所有 agent 能引用同一物理源或固定路径 | 同源 + junction（如 `skills/skill-creator`），或固定路径（如 `C:/Users/aogus/.my_secrets.env`） |
| B | 意图统一但各 agent 用不同格式/文件实现 | 写清参考意图 + 实现文件 + 验证；格式可不同，语义必须一致 |
| C | 私有状态/机器态/登录态，暂无法统一 | 不同步；只做清单、保守备份或恢复提示 |

B 类默认以 OpenCode 的规则/意图为语义参考。

## 各 agent 实现文件（当前）

| Agent | 规则文件 | 运行时 | skills 目录 |
|-------|----------|--------|-------------|
| Claude Code | `~/.claude/CLAUDE.md` | `~/.claude/settings.json` | `~/.claude/skills/` |
| Codex | `~/.codex/AGENTS.md` | `~/.codex/config.toml` | `~/.codex/skills/` |
| OpenCode（定制版）| `D:/Code/opencode/opencode-global-config/AGENTS.md` | `D:/Code/opencode/opencode-global-config/opencode.json` | `D:/Code/opencode/opencode-global-config/skills/` |
| Antigravity | `~/.antigravity/AGENTS.md` | `%APPDATA%/Antigravity/User/settings.json` | `~/.antigravity/skills/` |

跨 agent 同步还要带上参考文档：`AGENTS.md`、`README.md`、`references/*.md`、`B-INTENT-IMPLEMENTATION-MATRIX.md`。

**OpenCode 必须用定制版**：本项目的「OpenCode」一律指 `D:/Code/opencode/opencode-global-config/`（git 管理的权威源）。原版 `~/.config/opencode/` 只是运行时部署位，由用户自管，不作为维护目标。

## 工作流程

1. **读权威来源**（上面 5 项），建立"统一意图"基线。
2. **读目标 agent 的真实文件**（规则 + 运行时 + skills 目录实际内容），不要假设。
3. **按七个维度逐项比对**（见下）。
4. **列不一致**：每条写清「级别 / 涉及 agent / 要求来源 / 实际状态 / 原因」。
5. **定方向**：每条不一致是"修实现对齐文档"还是"修文档对齐实现"。方向不明时问用户，不要擅自选。
6. **执行**：跨 agent 全局规则变更默认同步到全部 agent 规则文件 + 参考文档；只在 runtime 专属字段上可不同步。
7. **验证**（见验证段）。

## 七个比对维度

1. **全局行为**：中文优先、PowerShell 优先、pnpm/bun、代码注释、不输出密钥、冲突先说明再处理。
2. **权限/文件访问/高危命令**：可信工作域写入免询问；`.env*`/`.git/**`/lock 写入或编辑前必须确认；`rm -rf`/`sudo`/生产发布/`deploy|prod|aws|vercel`/丢弃改动的 git 操作必须确认；报警类放行但事后列报；不擅自 revert 用户改动。
3. **secrets/login**：固定路径 `C:/Users/aogus/.my_secrets.env`（优先）、`.secrets.env`（明确引用才读）；静默读取、绝不输出值、不入库。
4. **browser/oauth**：Google 登录/OAuth/API 启用必须 `Start-Process` 系统默认浏览器，禁 Puppeteer/自动化 Chromium。
5. **mcp/tool**：Drive/Gmail/Calendar/search/browser 等价能力；缺失必须标 gap，不能伪装已实现。
6. **skills 分类 + backup**：A 类共享只放 `Harness Universal/skills/` 经 junction；B 类 entity 留各 agent 自己目录；backup 不含密钥值、只留一个最终 `<backup-id>/`。
7. **跨 agent 同步**：全局规则改动默认同步 4 个 agent 规则文件 + 参考文档；runtime 专属字段（settings.json 的 hooks、config.toml 的 sandbox 等）不强制同步。

## 关键实操经验（容易踩的坑）

- **runtime 能力差异是已登记 gap，不是缺陷**：Codex `config.toml` 为 `danger-full-access`+`approval_policy=never`，无硬 ask，靠 `developer_instructions` 行为规则承载；Antigravity 只有 VS Code 风格 settings，无细粒度权限拦截（标 `needs-runtime-verification`）；Claude `settings.json` 只有文件级 ask、没有 Bash 命令 ask matcher，命令确认靠规则文档 + harness 硬编码。比对时区分"语义一致但 runtime 弱"与"真不一致"。
- **OpenCode 定制版 vs 原版**：维护定制版 `opencode-global-config/`；原版 `~/.config/opencode/` 是部署位。`opencode.json` 的 permission 树是四者中最完整的（文件 ask + bash 命令 ask + 工具 allow），可作为权限意图的参考实现。
- **harness 敏感文件每次编辑弹确认**：`CLAUDE.md`/`AGENTS.md`/`settings.json` 在 Claude Code 有 harness 层硬确认，无法绕过。一轮对话里**批量**完成所有敏感文件改动，减少确认次数；不要因为弹确认就放弃或找替代。
- **worktree vs main**：A 类 skills 与 junction 指向**主检出** `D:/Code/Harness Universal/skills/`，不是 worktree 路径；`backups/` 在主检出和 worktree 分支可能内容不同，清理/核对前先确认在哪个检出、用 `git status` 看跟踪态。
- **settings.json 的 lock 规则要 Edit + Write 两个 matcher**：只配 `Write(*lock*)` 会漏掉编辑路径。
- **secrets 入库排查**：检查 git 是否跟踪了 `gdrive-credentials.json`、`*-token-result.json`、`*credentials*.json` 等；若有，`git rm --cached` + 补 `.gitignore`，不删本地、不读内容。
- **backup 卫生**：每次正式备份只留一个 `<backup-id>/`；清理 smoke-test/prechange/0KB 空壳等临时产物；未被 git 跟踪的目录删除是永久的，删前列清单确认。
- **skill-creator 在 git 仓库内做 junction**：要把 junction 路径加进该仓库 `.gitignore`（如 `opencode-global-config/skills/skill-creator/`），避免 git 跟踪 junction 内容。
- **维护流程有方向**：改 B 类意图时先改 `references/*.md` → 再 `B-INTENT-IMPLEMENTATION-MATRIX.md` → 再各 agent 实现；只改实现不改文档会造成"文档要求 vs 实现缺失"的 drift。
- **删能力时清干净**：移除某类 skill（如 migration）时，实体目录、各 agent 规则文件引用、references、matrix、README、skill-creator 正文都要一起清，最后 grep 残留。

## 验证

- 4 个 agent 规则文件都包含核心章节：本地文件策略、密钥管理、浏览器、工具与命令权限（含报警类）、交流规范、Skills 维护、跨 agent 同步。语义一致即可，不要求逐字。
- 运行时配置表达对应权限意图，或把无法 runtime 实现的部分明确标为 gap。
- 改动后 `grep` 旧引用（旧路径、已删能力名）确认 0 残留（备份历史快照里的不算）。
- skills 目录符合「A 类 junction + 各 agent entity」；junction 指向主源且有效。
- 对话和 git 仓库都不出现密钥值。
- 跨 agent 改动后，4 个规则文件 + 参考文档都已更新（或说明为何某项不同步）。

## 相关 skill

- 改 harness 前先备份：各 agent 的 `*-harness-backup-restore`（如 `claude-code-harness-backup-restore`、`codex-harness-backup-restore`）。
- 新建/迭代 skill 本身：`skill-creator`。

## 安全边界

- 不输出、复制或提交任何密钥、token、API key、password 值。
- `.env*`/`.git/**`/lock 文件、harness 敏感文件的写入要按各 agent 规则确认；不绕过 harness 硬确认。
- 高危递归删除、生产发布、丢弃用户改动的 git 操作执行前必须确认；删未跟踪目录前先列清单。
- 修改当前 workspace 与可信工作域外的文件前先确认。
- 方向（修实现 vs 修文档）不明确时问用户，不要擅自决定删哪边。

## 汇报格式

```markdown
已按本项目规则配置/审计 harness：
- 范围：<哪些 agent / 哪些维度>
- 一致项：<简述>
- 不一致与处理：<级别 | agent | 要求来源 | 实际 | 方向 | 已做/待确认>
- 跨 agent 同步：<已更新的规则文件 + 参考文档；未同步项及原因>
- 验证：<grep 残留、skills/junction、密钥检查结果>
- 待提交/待人工：<git 未提交改动、需用户决策项>
```
