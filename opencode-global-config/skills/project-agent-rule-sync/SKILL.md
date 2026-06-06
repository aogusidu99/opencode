---
name: project-agent-rule-sync
description: 当用户要求新增、修改、同步、检查项目级规则、仓库规则、子项目规则、AGENTS.md、CLAUDE.md、项目 instructions、项目 .agents/skills 或项目级 skill 时使用。自动把项目级规则按 AGENTS.md + CLAUDE.md 双写，检查二者一致，并让项目级 skills 放在 .agents/skills/<skill-name>/SKILL.md。Keywords: project rules, repo instructions, AGENTS.md, CLAUDE.md, .agents/skills, project skill, sync project agent rules.
---

# 项目级规则同步

让项目内的规则和项目级 skills 对 Codex/OpenCode/Antigravity 与 Claude Code 都尽量可用，避免只写一个 agent 能读取的文件。

## 触发场景

使用此 skill，当用户表达以下任一意图：

- 修改当前项目、仓库、子项目、目录下的 agent 规则或 instructions。
- 新增或更新项目级 `AGENTS.md`、`CLAUDE.md`、`AGENTS.override.md` 或类似项目规则文件。
- 创建、移动或修改项目级 skill、`.agents/skills`、项目 workflow skill。
- 要求“以后这个项目的 agent 都遵守”“不同 agent 都能识别”“项目级规则双写”等。

如果用户明确限定只改某一个 agent 的私有规则，按用户限定处理，并说明这不会自动跨 agent 生效。

## 工作流程

1. 确认项目规则所在目录。
   - 默认使用当前 workspace 或用户指定的项目/子项目目录。
   - 如果规则只针对子目录，就在该子目录同时维护 `AGENTS.md` 与 `CLAUDE.md`。

2. 同步项目级规则。
   - 默认同时创建或更新同目录的 `AGENTS.md` 与 `CLAUDE.md`。
   - 两个文件的核心规则必须等价。
   - 只允许保留少量 agent 专属差异，例如 Claude Code 的文件名说明、Codex 的 `.agents/skills` 扫描说明。
   - 使用标准大写文件名：`AGENTS.md`、`CLAUDE.md`。

3. 同步项目级 skill。
   - 项目级 skill 默认放在 `.agents/skills/<skill-name>/SKILL.md`。
   - `skill-name` 使用 kebab-case。
   - 在同目录 `AGENTS.md` 与 `CLAUDE.md` 中只写简短引用：skill 名称、用途、位置、何时使用。
   - 不要把完整 `SKILL.md` 内容复制进规则文件。

4. 处理已有文件。
   - 如果只有 `AGENTS.md` 或只有 `CLAUDE.md`，并且用户意图是跨 agent 生效，补齐另一个文件。
   - 如果两个文件都存在且内容冲突，先读取差异，保留两边有效规则，再合并成核心一致的版本。
   - 不要删除用户已有规则；除非规则明确过期或用户要求，否则只做合并和整理。

5. 验证。
   - 运行 `scripts/Sync-ProjectAgentRules.ps1 -ProjectDir <dir> -Mode Check` 检查双写文件是否存在且一致。
   - 若用户明确要以某一份为准镜像另一份，可运行 `-Mode Mirror -Source AGENTS` 或 `-Source CLAUDE`。
   - 检查 `.agents/skills/<skill-name>/SKILL.md` 是否存在，且规则文件中引用了该项目级 skill。

## 配套脚本

- `scripts/Sync-ProjectAgentRules.ps1`
  - `-Mode Check`：检查 `AGENTS.md` 与 `CLAUDE.md` 是否同时存在且内容一致。
  - `-Mode Mirror`：在明确 source 时镜像补齐另一份。
  - `-Source Auto|AGENTS|CLAUDE`：选择镜像来源。两个文件内容冲突时不要用 `Auto` 强行覆盖。

## 安全边界

- 不编辑 `.env*`、`.git/**`、lock 文件。
- 不把密钥、token 或账号信息写入规则或 skill。
- 不为了“同步”覆盖未理解的项目规则；先合并语义，再写入。
- 项目级规则不替代全局 harness 规则；项目规则只增加或细化当前项目约定。

## 输出要求

完成后简要报告：

- 更新了哪个目录下的 `AGENTS.md` 与 `CLAUDE.md`。
- 是否新增或更新了 `.agents/skills/<skill-name>/SKILL.md`。
- 验证脚本是否通过。
- 是否存在无法自动统一的 agent 专属差异。
