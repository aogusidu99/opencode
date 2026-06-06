---
name: harness-global-rule-sync
description: 当用户要求新增、修改、同步、检查全局 harness 规则、跨 agent 规则、全局 AGENTS.md/CLAUDE.md、Codex/Claude/OpenCode/Antigravity 规则文件、共享 skills、junction、缺失 skill、全局 skill 分发或让不同 agent 保持规则/skill 一致时使用。自动按 5 份全局规则文件同步，并检查 D:/Code/Harness Universal/skills 的共享 skill 链接。Keywords: global harness rules, cross-agent sync, shared skills, junction, AGENTS.md, CLAUDE.md, Codex, Claude Code, OpenCode, Antigravity.
---

# 全局 Harness 规则同步

让全局 harness 规则和共享 skills 在 Codex、Claude Code、OpenCode、Antigravity 之间保持一致，避免只改一个 agent 后产生漂移。

## 触发场景

使用此 skill，当用户表达以下任一意图：

- 修改全局规则、harness 规则、跨 agent 规则、权限策略、密钥策略、浏览器策略、交流规范。
- 修改任一全局规则文件：`~/.codex/AGENTS.md`、`~/.claude/CLAUDE.md`、`D:/Code/opencode/opencode-global-config/AGENTS.md`、`~/.antigravity/AGENTS.md`、`D:/Code/Harness Universal/AGENTS.md`。
- 新增、修改、删除共享 skill 或 agent harness skill。
- 检查或修复 skill junction、缺失 skill、共享 skill 是否分发到各 agent。
- 用户说“所有 agent 都要一样”“以后不用单独交代”“全局同步”“规则和 skill 一致”。

如果用户明确限定只改某一个 agent 的运行时配置，例如 Codex `config.toml`、Claude `settings.json`、OpenCode `opencode.json`，不要强制同步到其他 agent；只在规则层说明差异。

## 全局规则同步流程

1. 判定变更类型。
   - 全局规则：同步到 5 份规则文件。
   - 共享 skill：维护 `D:/Code/Harness Universal/skills/<skill-name>/`，再检查各 agent junction。
   - agent 专属运行时配置：只改对应 agent 文件，不强制跨 agent 同步。

2. 同步 5 份全局规则文件。
   - `C:/Users/aogus/.claude/CLAUDE.md`
   - `C:/Users/aogus/.codex/AGENTS.md`
   - `D:/Code/opencode/opencode-global-config/AGENTS.md`
   - `C:/Users/aogus/.antigravity/AGENTS.md`
   - `D:/Code/Harness Universal/AGENTS.md`
   - 核心规则内容保持一致；允许保留每个 agent 的标题、加载机制说明、运行时配置差异说明。

3. 同步共享 skills。
   - 长期跨项目共享的 skill 源目录是 `D:/Code/Harness Universal/skills/<skill-name>/`。
   - 每个共享 skill 必须包含 `SKILL.md`。
   - 为各 agent 本地 skills 目录建立 junction：
     - `C:/Users/aogus/.codex/skills/<skill-name>`
     - `C:/Users/aogus/.claude/skills/<skill-name>`
     - `C:/Users/aogus/.config/opencode/skills/<skill-name>`
     - `C:/Users/aogus/.antigravity/skills/<skill-name>`
   - 如果某个 agent 不支持 junction 或项目级 `.agents/skills` 自动扫描，记录为需要实体同步或运行时验证。

4. 处理项目级 skill 兼容性。
   - 项目级 skill 优先使用 `.agents/skills/<skill-name>/SKILL.md`。
   - 项目规则由 `project-agent-rule-sync` 负责双写 `AGENTS.md` 与 `CLAUDE.md`。
   - 本 skill 只在全局检查中提示项目 `.agents/skills` 是否存在 `SKILL.md`、是否被项目规则引用。

5. 验证。
   - 运行 `scripts/Sync-HarnessGlobalRules.ps1 -Mode Check` 检查全局规则 marker 与共享 skill junction。
   - 需要补齐缺失 junction 时，运行 `scripts/Sync-HarnessGlobalRules.ps1 -Mode FixJunctions`。
   - 如果检查发现已存在但不是 junction 的同名目录，不要覆盖；先报告给用户。

## 配套脚本

- `scripts/Sync-HarnessGlobalRules.ps1`
  - `-Mode Check`：检查 5 份规则文件是否存在并包含关键同步规则，检查共享 skill junction 是否齐全。
  - `-Mode FixJunctions`：为缺失的共享 skill 创建 junction；不会覆盖已有实体目录或错误目标。
  - `-ProjectDir <dir>`：可选检查项目 `.agents/skills` 是否有 `SKILL.md`，以及项目规则是否引用项目 skills。

## 安全边界

- 不编辑 `.env*`、`.git/**`、lock 文件。
- 不输出密钥、token、refresh token、client secret 或 API key。
- 不把 agent 专属运行时配置强行改成完全相同。
- 不删除已有 skill 或 junction；删除仍需用户明确要求并确认风险。
- 遇到规则文件已有用户改动时，先合并，不做盲目覆盖。

## 输出要求

完成后简要报告：

- 哪 5 份全局规则文件已更新或检查。
- 哪些共享 skills 已创建或更新。
- 哪些 junction 已存在、已补齐、或存在冲突。
- 是否还有需要运行时验证的 agent。
