---
name: opencode-harness-backup-restore
description: 备份和还原 OpenCode 非 junction harness 文件：AGENTS.md、runtime config、custom commands、MCP scripts、项目级 agents/config、secret references 和 junction metadata。用户要求备份 OpenCode harness、创建可回滚快照、还原或比较 OpenCode 全局配置时使用。Keywords: backup, restore, rollback, snapshot, harness, OpenCode.
---

# OpenCode Harness 备份与还原

给 OpenCode 的非 junction harness 文件做可审计、可回滚的快照。A 类共享 skills 由 `D:/Code/Harness Universal/skills/` 通过 junction 或固定源管理，只记录元数据，不复制内容。

## 备份范围

1. Memory / Rules
   - `%USERPROFILE%\.config\opencode\AGENTS.md`
2. Runtime Config
   - `%USERPROFILE%\.config\opencode\config.json`
   - `%USERPROFILE%\.config\opencode\opencode.json` 或兼容配置（如存在）
   - `%USERPROFILE%\.config\opencode\tui.json`（如存在）
3. Commands / Agents / MCP
   - 自定义 commands、agents/subagents、MCP scripts 和 project-level harness overrides（如存在）
4. Skills
   - 备份 OpenCode 专属 entity skills。
   - A 类共享 junction skills 只记录 link path、target、是否有效，不复制内容。
5. Secrets / Accounts
   - 只记录路径、存在性、mtime、size。
   - 不复制 API key、OAuth token、refresh token、credential JSON、`.my_secrets.env`、`.secrets.env`。

## 快照位置

默认写入：

```text
D:/Code/Harness Universal/backups/opencode/<snapshot-id>/
```

快照 ID 格式：

```text
opencode-harness-yyyyMMdd-HHmmss-v1[-label]
```

## 单次备份输出约束

- 一次正式备份在 `D:/Code/Harness Universal/backups/opencode/` 下只保留一个最终子文件夹：`<snapshot-id>/`。
- 如果备份过程中为了安全或原子化写入创建临时目录、staging 目录、preflight 快照、smoke-test 快照等，最终备份验证通过后应清理这些临时产物。
- 如果生成 zip、`.sha256` 或独立 `RESTORE.md`，默认放进同一个 `<snapshot-id>/` 子文件夹内；不要在 `backups/opencode/` 根下额外散放 sibling 文件，除非用户明确指定外部导出位置。

每个快照至少包含：

- `manifest.json`
- `RESTORE.md`
- `memory-rules/`
- `runtime/`
- `skills/` 或 skills inventory
- `inventories/`

## 还原规则

- restore 必须先 dry-run，列出将覆盖的文件和缺口。
- restore apply 前可以创建 pre-restore backup；如果该 pre-restore 只是本次 apply 的临时保险快照，并且最终 restore 已验证成功，可以清理该临时快照。
- restore 不默认 prune 用户现有内容，除非用户明确要求。

## 安全规则

- 不输出或复制密钥值。
- 不备份 token、auth、cache、sqlite、session、浏览器缓存和机器特定 ID。
- 不覆盖目标文件，除非用户明确选择 apply。
- 跨设备恢复时 OAuth 和登录态重新授权。

## 汇报格式

备份后输出：

```markdown
已创建 OpenCode harness 备份：

- 快照：`<snapshot-id>`
- 路径：`<absolute snapshot path>`
- 本次最终备份子文件夹：1 个
- 已备份：AGENTS.md、runtime config、entity skills、commands/agents/MCP 清单
- 已排除：secret/token/auth/cache/session、A 类 junction skill 内容
- 临时产物：已清理 / 未创建
```
