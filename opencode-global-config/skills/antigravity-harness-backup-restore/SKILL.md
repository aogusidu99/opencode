---
name: antigravity-harness-backup-restore
description: 备份和还原 Antigravity 五层 agent harness 定制内容：Memory/Rules、Runtime Config、Skills、MCP/Tools、Secrets/Accounts。用户要求备份 Antigravity harness、创建可回滚快照、记录文件路径和版本、迁移前保存现状、迁移失败后恢复、比较备份与当前配置、或根据 skill 完整还原 Antigravity 全局配置时使用。Keywords: backup, restore, rollback, snapshot, harness, Antigravity, VS Code fork.
---

# Antigravity Harness 备份与还原

这个 skill 用来给 Antigravity 五层 harness 做可审计、可回滚的快照。目标是：迁移或修改前先保存当前状态；如果后续发现迁移有问题，可以按快照还原规则、配置和用户自定义 skills。

Antigravity 基于 VS Code fork，与 Codex / Claude Code 的 CLI 模式有显著差异——它有完整 IDE 资产（extensions、snippets、workspaceStorage、globalStorage、workspace trust）。本 skill 已为 VS Code-fork 形态做了专门的备份范围划分。

> ⚠️ **Antigravity 多个关键位置加载机制未验证。** `~/.antigravity/AGENTS.md`（规则）、`~/.antigravity/skills/`（本地 skills）、`~/.antigravity/keybindings.json` 等的实际加载行为尚未在运行时确认。本 skill 默认按上述路径备份，但快照 manifest 中会显式列出 `needs-runtime-verification` 项。

## 备份范围

按五层处理：

1. Memory / Rules
   - 备份 `%USERPROFILE%\.antigravity\AGENTS.md`（如存在）
   - 备份 `%USERPROFILE%\.antigravity\rules\*`（如启用）
   - 标注此位置 `needs-runtime-verification`：Antigravity 实际从哪里读规则尚未确认
2. Runtime Config
   - 备份 `%APPDATA%\Antigravity\User\settings.json`（VS Code-style 全局设置）
   - 备份 `%APPDATA%\Antigravity\User\keybindings.json`（如存在）
   - 备份 `%APPDATA%\Antigravity\User\snippets\*.json`（用户代码片段）
   - 备份 `%USERPROFILE%\.antigravity\argv.json`（Antigravity argv 覆盖；注意 `crash-reporter-id` 是机器特定，跨机器还原时应重新生成或保留新机器原值）
3. Skills
   - 备份 `%USERPROFILE%\.antigravity\skills\` 下的用户自定义 skill（如存在）
   - 跨 agent 共享的 skill（如 `skill-creator`）通常是 junction，仅备份 junction 元数据（target、是否解析），不备份内容
   - 不复制 marketplace 或 plugin 分发的 skill 内容
4. MCP / Tools
   - 通过 `settings.json` 中 AI 扩展相关字段记录工具配置（具体字段名待运行时确认）
   - 备份 `%USERPROFILE%\.antigravity\extensions\extensions.json`（已安装扩展清单）
   - **不备份** `%USERPROFILE%\.antigravity\extensions\<extension-dir>/*` 实际扩展二进制内容（可通过 marketplace 重装）
   - 备份 `%APPDATA%\Antigravity\User\globalStorage\` 的**顶层目录清单**（扩展本地存储），但**不复制** `state.vscdb` 二进制内容（SQLite 文件，含 prompt history 与 UI 状态）
5. Secrets / Accounts
   - 只记录路径、存在性、mtime、size
   - 不复制 `auth.json`、OAuth token、API key、refresh token、`.my_secrets.env`、`.secrets.env`、Antigravity 内置 Gemini 扩展的本地凭据等敏感内容
   - 不复制 `state.vscdb`（可能含会话 token 或敏感 UI 状态）

这样可以还原 harness 的规则、配置、skills、extensions 清单和工具引用；账号登录态、Gemini API key、扩展授权 token 仍由原本的本机凭据、连接器或重新授权提供。

## 快照位置

默认写入：

```text
opencode-global-config/harness-backups/antigravity/<snapshot-id>/
```

每个快照必须包含：

- `manifest.json`：机器可读清单，包含时间、版本、源路径、备份路径、哈希、排除项、`needs-runtime-verification` 项清单。
- `RESTORE.md`：中文还原说明。
- `memory-rules/`：规则类文件（AGENTS.md、rules/ 等）。
- `runtime/`：Antigravity runtime 配置文件（User/settings.json、keybindings.json、argv.json、snippets/）。
- `skills/`：用户自定义 skills（junction 元数据或实体内容）。
- `inventories/`：扩展清单、globalStorage 目录清单、workspaceStorage 目录清单、根目录状态、敏感路径引用清单。
- `restore-tools/`：随快照携带的本 skill 说明、备份脚本、还原脚本和 Drive 上传脚本；用于新电脑上没有预装 skill 时自恢复。

快照 ID 格式：

```text
antigravity-harness-yyyyMMdd-HHmmss-v1[-label]
```

如果需要放到 Google Drive、NAS、U 盘或另一台电脑，生成 zip 迁移包。目录快照适合本机直接恢复；zip 适合跨设备搬运。

默认 Google Drive 备份文件夹：

```text
https://drive.google.com/drive/folders/10-YC5YN9j3jdJBcyQOegPQhv5sTcCq1F
```

用户要求"备份 Antigravity harness"时，默认创建本地快照、生成 zip 和 `.sha256`，并直接上传到上述 Google Drive 文件夹；不要再单独询问是否上传。只有用户明确说"只本地备份""不要上传"时，才跳过上传。

生成 zip 时，必须同时在 zip 旁边输出独立还原说明：

```text
<snapshot-id>.RESTORE.md
```

上传到 Google Drive 时，默认上传 3 个文件：`.zip`、`.zip.sha256`、`.RESTORE.md`。

## 创建备份

从仓库根目录运行（脚本待移植）：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Backup-AntigravityHarness.ps1 -CreateArchive -UploadToDrive
```

可选参数：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Backup-AntigravityHarness.ps1 -Version v1 -Label before-opencode-migration -CreateArchive -UploadToDrive
```

生成可迁移压缩包（不上传）：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Backup-AntigravityHarness.ps1 -Version v1 -Label before-opencode-migration -CreateArchive
```

如果需要改用其他 Drive 文件夹：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Backup-AntigravityHarness.ps1 -CreateArchive -UploadToDrive -DriveFolderUrl "https://drive.google.com/drive/folders/<folder-id>"
```

使用本机已有 Google Drive OAuth token 上传到 Drive（脚本是 agent-neutral，可复用 Codex 版）：

```powershell
.\opencode-global-config\skills\codex-harness-backup-restore\scripts\Upload-CodexHarnessArchiveToDrive.ps1 -ArchivePath "<ArchivePath>" -RestoreGuidePath "<snapshot-id>.RESTORE.md" -DriveFolderUrl "https://drive.google.com/drive/folders/<folder-id>"
```

上传脚本默认读取 `%USERPROFILE%\.config\mcp-google-drive\tokens.json` 和 `%USERPROFILE%\.config\mcp-google-drive\gcp-oauth.keys.json`。

备份完成后，检查输出的 `SnapshotPath`，并打开该目录的 `RESTORE.md` 和 `manifest.json`。

## 还原备份

先 dry-run：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Restore-AntigravityHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\antigravity\<snapshot-id>"
```

确认计划无误后再真正还原：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Restore-AntigravityHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\antigravity\<snapshot-id>" -Apply
```

如果要让用户自定义 skills、snippets 完全回到快照状态，可以加 `-PruneExtensions`（移除快照中没有但当前 Antigravity 有的用户扩展资产，自动创建 pre-restore 备份）：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Restore-AntigravityHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\antigravity\<snapshot-id>" -Apply -PruneExtensions
```

跨电脑迁移时，下载 zip 后使用 `-ArchivePath`：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Restore-AntigravityHarness.ps1 -ArchivePath ".\antigravity-harness-xxxx.zip"
```

确认 dry-run 的 `AntigravityUserHome` 与 `AntigravityAppData` 分别是新电脑当前用户的 `%USERPROFILE%\.antigravity` 与 `%APPDATA%\Antigravity\User`，再执行：

```powershell
.\opencode-global-config\skills\antigravity-harness-backup-restore\scripts\Restore-AntigravityHarness.ps1 -ArchivePath ".\antigravity-harness-xxxx.zip" -Apply
```

脚本按 `manifest.json` 里的 `antigravity_user_relative` / `antigravity_appdata_relative` 相对路径分别恢复到目标电脑的 `AntigravityUserHome` / `AntigravityAppData`，不会把原电脑的绝对路径硬写回新电脑。

**跨机器还原的特殊处理：**

- `argv.json` 中的 `crash-reporter-id` 不要覆盖；新机器应保留自己的 ID（如已存在）。
- `extensions/extensions.json` 仅作清单参考；实际扩展安装需调用 `antigravity --install-extension <id>` 或在 Marketplace 重装。
- `workspaceStorage/*` 与 `globalStorage/state.vscdb` 默认**不还原**（机器/workspace 特定），用户如需可手动选择。

如果新电脑还没有安装这个 skill，先解压 zip，进入快照目录后运行随包携带的脚本：

```powershell
.\restore-tools\scripts\Restore-AntigravityHarness.ps1 -SnapshotPath "."
.\restore-tools\scripts\Restore-AntigravityHarness.ps1 -SnapshotPath "." -Apply
```

## 安全规则

- 不输出或复制密钥值。
- 不把 `auth.json`、OAuth token、`.my_secrets.env`、`.secrets.env`、Antigravity 内置 Gemini 扩展凭据、`state.vscdb`（可能含会话 token）放进快照内容。
- 备份包只包含非密钥 harness 内容；用户已经要求默认上传到指定 Google Drive 文件夹，所以备份后的 Drive 上传无需二次确认。
- 不覆盖 Antigravity 目标文件，除非用户明确选择 restore `-Apply`。
- 真正还原前必须先 dry-run，除非用户明确要求直接应用。
- 还原前自动创建 pre-restore 备份，避免二次损坏。
- 还原后重新读取 `AGENTS.md`、`settings.json`、`snippets/`、skills 清单确认文件存在。
- **不备份** `%APPDATA%\Antigravity\Cache\`、`Code Cache\`、`GPUCache\`、`CachedConfigurations\`、`CachedData\`、`CachedExtensionVSIXs\`、`logs\` 等 Electron/Chromium 缓存目录——这些是浏览器内核运行时缓存，跨机器无意义，且占空间。
- **不备份** `workspaceStorage/<workspace-uuid>/*` 内容（仅记录清单），避免快照膨胀和泄露交互内容。
- **不备份** `globalStorage/state.vscdb` 二进制（仅记录清单），避免 SQLite 状态/敏感字段泄露。
- **不备份** `extensions/<extension-dir>/*` 实体内容（仅记录 `extensions.json` 清单），扩展应通过 Marketplace 重装。

## 汇报格式

备份后输出：

```markdown
已创建 Antigravity harness 备份：

- 快照：`<snapshot-id>`
- 路径：`<absolute snapshot path>`
- 版本：`v1`
- 时间：`<local time>` / `<UTC time>`
- Drive 上传：`<zip link>`、`<sha256 link>`
- 独立还原说明：`<restore md link>`
- 已备份：AGENTS.md、User/settings.json、User/keybindings.json、User/snippets/、argv.json、用户 skills、extensions.json 清单、globalStorage 顶层清单、workspaceStorage 顶层清单
- 已排除：auth.json、token、secret env、Cache/Code Cache/GPUCache 等 Electron 缓存、extensions 实体内容、state.vscdb 二进制、workspaceStorage 内容、Gemini 扩展本地凭据
- needs-runtime-verification 项：AGENTS.md 加载位置、skills 目录、keybindings.json 位置、MCP 接入机制等
```

还原后输出：

```markdown
已还原 Antigravity harness：

- 来源快照：`<snapshot-id>`
- 还原文件：...
- 还原 skills / snippets：...
- 还原 extensions 清单（需手动重装）：...
- 自动创建的还原前备份：...
- 仍需人工处理：
  - 账号登录态、连接器授权、外部 OAuth token
  - 扩展实体重装（按 extensions.json 清单逐项 Marketplace 安装）
  - Antigravity 内置 Gemini 扩展的 API key 与会话授权
  - needs-runtime-verification 项的实际位置确认
```
