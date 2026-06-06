---
name: opencode-harness-backup-restore
description: 备份和还原 OpenCode 非 junction harness 文件：AGENTS.md、opencode.json、tui.json、custom commands、MCP scripts、项目级 agents。共享 Skills 已通过 junction 链接到 harness-universal 仓库，由 git 管理，不在备份范围内。Keywords: backup, restore, rollback, snapshot, harness, OpenCode.
---

# OpenCode Harness 备份与还原

给 OpenCode 的**非 junction** harness 文件做可审计、可回滚的快照。

共享 Skills 已通过 junction 链接到 `D:\Code\Harness Universal\skills\`，由 git 版本管理，**不在本 skill 的备份范围内**。

## OpenCode 配置架构

OpenCode 的全局配置通过 junction 桥接：

```
~/.config/opencode  →  D:\Code\opencode\opencode-global-config
```

项目级配置在 `D:\Code\opencode\.opencode\`，可覆盖全局配置。

## 备份范围

只备份非 junction 的 harness 文件：

1. Memory / Rules
   - `opencode-global-config/AGENTS.md`（全局规则）
2. Runtime Config
   - `opencode-global-config/opencode.json`（权限、MCP、实验性功能）
   - `opencode-global-config/tui.json`（TUI 快捷键）
3. Commands
   - `opencode-global-config/command/*.md`（自定义命令）
4. MCP Scripts（非 node_modules 文件）
   - `opencode-global-config/mcp-scripts/gemini-search/server.mjs`
   - 其他自定义 MCP server 脚本
5. Project-level Config
   - `.opencode/agent/*.md`（项目级自定义 agents）
   - `.opencode/opencode.jsonc`（项目级配置覆盖）
   - `.opencode/tui.json`（项目级 TUI 配置）
6. Inventories（只记录清单，不复制内容）
   - skills junction 元数据（target 路径、是否有效）
   - MCP 服务器配置清单（从 opencode.json 提取）
   - 敏感路径引用清单
7. Secrets / Accounts
   - 只记录路径、存在性、mtime、size
   - **不复制**任何密钥、token、credential

**不备份：**
- Junction'd skills（由 git 管理）
- `node_modules/`、`package-lock.json`、`package.json`
- `.opencode/chrome_data/`（Chromium 临时数据，体积大）
- `.opencode/accounts.local.json`（凭据）
- `.opencode/login_*.js`、`open_*.js`（自动化登录脚本，含凭据引用）
- `opencode-global-config/harness-backups/`（旧备份残留）
- `HARNESS-ARCHITECTURE.md`（参考文档，不是配置）
- `.opencode/env.d.ts`（类型声明，非配置）

## 快照位置

默认写入 harness-universal 仓库：

```text
D:\Code\Harness Universal\harness-backups\opencode\<snapshot-id>\
```

每个快照包含：

- `manifest.json`：机器可读清单（时间、版本、源路径、哈希、排除项、junction 元数据）
- `RESTORE.md`：中文还原说明
- `memory-rules/`：AGENTS.md
- `runtime/`：opencode.json、tui.json
- `commands/`：自定义命令
- `mcp-scripts/`：MCP server 脚本
- `project-agents/`：项目级 agent 定义
- `project-config/`：项目级配置覆盖
- `inventories/`：skills junction、MCP 清单、根目录状态、敏感路径引用

快照 ID 格式：`opencode-harness-yyyyMMdd-HHmmss-v1[-label]`

备份完成后，变更已在 harness-universal 仓库中，可通过 `git add` + `git commit` 纳入版本管理。**不再默认上传到 Google Drive**。

## 创建备份

由 agent 按本 SKILL.md 的范围说明完成备份。步骤：

1. 确定快照 ID：`opencode-harness-<yyyyMMdd-HHmmss>-v1[-label]`
2. 在 `D:\Code\Harness Universal\harness-backups\opencode\<snapshot-id>\` 下创建子目录结构
3. 复制备份范围内的文件到对应子目录
4. 记录 skills junction 元数据和 MCP 配置清单
5. 生成 `manifest.json`（含所有文件哈希和排除项清单）
6. 生成 `RESTORE.md`

## 还原备份

1. 先 dry-run：读取 `manifest.json`，对比快照内容与当前文件，列出将被覆盖的文件和差异
2. 确认后创建 pre-restore 备份（自动），再逐文件覆盖
3. 还原后验证：重新读取 AGENTS.md、opencode.json、命令、MCP 脚本确认文件存在

跨电脑迁移时：确认 `~/.config/opencode` junction 指向正确位置后，按 manifest 还原。

## 安全规则

- 不输出或复制密钥值
- 不把 `accounts.local.json`、OAuth token、`.my_secrets.env`、`.secrets.env`、MCP credential 环境变量值放进快照
- 不覆盖目标文件，除非用户明确要求 Apply
- 真正还原前必须先 dry-run
- 还原前自动创建 pre-restore 备份

## 汇报格式

备份后输出：

```markdown
已创建 OpenCode harness 备份：

- 快照：`<snapshot-id>`
- 路径：`<absolute snapshot path>`
- 时间：`<local time>` / `<UTC time>`
- 已备份：AGENTS.md、opencode.json、tui.json、commands、MCP scripts、project agents
- Skills junction 记录：<N> 个 junction 元数据（内容由 git 管理）
- 已排除：junction'd skills、credentials、chrome_data、node_modules、login scripts
```

还原后输出：

```markdown
已还原 OpenCode harness：

- 来源快照：`<snapshot-id>`
- 还原文件：...
- 自动创建的还原前备份：...
- 仍需人工处理：
  - MCP credential 环境变量重新配置
  - junction 桥接验证（~/.config/opencode → opencode-global-config）
  - Skills junction 重建（如路径变更）
```
