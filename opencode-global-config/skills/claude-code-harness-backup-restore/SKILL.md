---
name: claude-code-harness-backup-restore
description: 备份和还原 Claude Code 五层 agent harness 定制内容：Memory/Rules、Runtime Config、Skills、MCP/Tools、Secrets/Accounts。用户要求备份 Claude Code harness、创建可回滚快照、记录文件路径和版本、迁移前保存现状、迁移失败后恢复、比较备份与当前配置、或根据 skill 完整还原 Claude Code 全局配置时使用。Keywords: backup, restore, rollback, snapshot, harness, Claude Code.
---

# Claude Code Harness 备份与还原

这个 skill 用来给 Claude Code 五层 harness 做可审计、可回滚的快照。目标是：迁移或修改前先保存当前状态；如果后续发现迁移有问题，可以按快照还原规则、配置和用户自定义 skills。

## 备份范围

按五层处理：

1. Memory / Rules
   - 备份 `%USERPROFILE%\.claude\CLAUDE.md`
   - 备份 `%USERPROFILE%\.claude\memory\*`（如启用 auto-memory）
   - 备份 `%USERPROFILE%\.claude\projects\<project>\memory\*`（按用户选择，默认排除避免快照过大）
2. Runtime Config
   - 备份 `%USERPROFILE%\.claude\settings.json`
   - 备份 `%USERPROFILE%\.claude\keybindings.json`
   - 记录但默认不复制 `%USERPROFILE%\.claude\projects\<path>\` 下的会话历史，因为里面包含 prompt history 和大量 transcript。
3. Skills
   - 备份 `%USERPROFILE%\.claude\skills` 下的用户自定义 skill。
   - 不复制 plugin marketplace 分发的 skills（如 `anthropic-skills:*`），只记录清单；它们属于系统/插件分发内容，不应混入用户 harness 快照。
4. MCP / Tools
   - 通过 `settings.json` 的 `mcpServers` 字段、`enabledMcpjsonServers`、`disabledMcpjsonServers`、`enableAllProjectMcpServers` 备份工具配置。
   - 备份 `%USERPROFILE%\.claude\agents\*.md` 和 `%USERPROFILE%\.claude\commands\*.md`（用户自定义 subagents 与 slash commands）。
   - 记录 `%USERPROFILE%\.claude\plugins` 的存在性和顶层清单；不复制插件缓存或 marketplace 下载的二进制内容。
   - 记录 hooks 配置（已包含在 settings.json 内），不需单独提取，但在 manifest 中列出 hook 命令清单便于审计。
5. Secrets / Accounts
   - 只记录路径、存在性、mtime、size。
   - 不复制 `auth.json`、OAuth token、API key、refresh token、`.my_secrets.env`、`.secrets.env`、`apiKeyHelper` 脚本所引用的密钥源文件等敏感内容。

这样可以还原 harness 的规则、配置、skills、subagents、slash commands 和工具引用；账号登录态和真实凭据仍由原本的本机凭据、连接器或重新授权提供。

## 快照位置

默认写入：

```text
opencode-global-config/harness-backups/claude-code/<snapshot-id>/
```

每个快照必须包含：

- `manifest.json`：机器可读清单，包含时间、版本、源路径、备份路径、哈希、排除项。
- `RESTORE.md`：中文还原说明。
- `memory-rules/`：规则类文件（CLAUDE.md、memory 索引等）。
- `runtime/`：Claude Code runtime 配置文件（settings.json、keybindings.json）。
- `skills/`：用户自定义 skills。
- `agents/`：用户自定义 subagents。
- `commands/`：用户自定义 slash commands。
- `inventories/`：插件、marketplace 分发 skills、根目录状态、敏感路径引用、hooks 命令清单。
- `restore-tools/`：随快照携带的本 skill 说明、备份脚本、还原脚本和 Drive 上传脚本；用于新电脑上没有预装 skill 时自恢复。

快照 ID 格式：

```text
claude-code-harness-yyyyMMdd-HHmmss-v1[-label]
```

如果需要放到 Google Drive、NAS、U 盘或另一台电脑，生成 zip 迁移包。目录快照适合本机直接恢复；zip 适合跨设备搬运。

默认 Google Drive 备份文件夹：

```text
https://drive.google.com/drive/folders/10-YC5YN9j3jdJBcyQOegPQhv5sTcCq1F
```

用户要求"备份 Claude Code harness"时，默认创建本地快照、生成 zip 和 `.sha256`，并直接上传到上述 Google Drive 文件夹；不要再单独询问是否上传。只有用户明确说"只本地备份""不要上传"时，才跳过上传。

生成 zip 时，必须同时在 zip 旁边输出独立还原说明：

```text
<snapshot-id>.RESTORE.md
```

上传到 Google Drive 时，默认上传 3 个文件：`.zip`、`.zip.sha256`、`.RESTORE.md`。这样另一台电脑不用先解压 zip，也能直接查看还原步骤。

## 创建备份

从仓库根目录运行：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Backup-ClaudeCodeHarness.ps1 -CreateArchive -UploadToDrive
```

可选参数：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Backup-ClaudeCodeHarness.ps1 -Version v1 -Label before-opencode-migration -CreateArchive -UploadToDrive
```

生成可迁移压缩包：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Backup-ClaudeCodeHarness.ps1 -Version v1 -Label before-opencode-migration -CreateArchive
```

如果要把包放到 Google Drive，先生成 zip，再上传 `ArchivePath` 指向的 `.zip` 和旁边的 `.sha256`。Google Drive 网页 URL 不是本地文件路径，不能直接作为 `-BackupRoot`；如果本机安装了 Drive for desktop，可以把 `-BackupRoot` 指到同步目录。
同时要上传独立的 `<snapshot-id>.RESTORE.md`。

如果需要改用其他 Drive 文件夹，显式传入：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Backup-ClaudeCodeHarness.ps1 -CreateArchive -UploadToDrive -DriveFolderUrl "https://drive.google.com/drive/folders/<folder-id>"
```

使用本机已有 Google Drive OAuth token 上传到 Drive 文件夹：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Upload-ClaudeCodeHarnessArchiveToDrive.ps1 -ArchivePath "<ArchivePath>" -RestoreGuidePath "<snapshot-id>.RESTORE.md" -DriveFolderUrl "https://drive.google.com/drive/folders/<folder-id>"
```

如果历史备份已经上传了 zip 和 sha256，只需要补传独立还原说明：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Upload-ClaudeCodeHarnessArchiveToDrive.ps1 -ArchivePath "<ArchivePath>" -RestoreGuidePath "<snapshot-id>.RESTORE.md" -DriveFolderUrl "https://drive.google.com/drive/folders/<folder-id>" -OnlyRestoreGuide
```

上传脚本默认读取 `%USERPROFILE%\.config\mcp-google-drive\tokens.json` 和 `%USERPROFILE%\.config\mcp-google-drive\gcp-oauth.keys.json`，只使用 token 调用 Drive API，不会输出 token。

备份完成后，检查输出的 `SnapshotPath`，并打开该目录的 `RESTORE.md` 和 `manifest.json`。

## 还原备份

先 dry-run：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Restore-ClaudeCodeHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\claude-code\<snapshot-id>"
```

确认计划无误后再真正还原：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Restore-ClaudeCodeHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\claude-code\<snapshot-id>" -Apply
```

如果要让用户自定义 skills、subagents、slash commands 完全回到快照状态，可以加 `-PruneExtensions`。这会移除当前 Claude Code 中存在但快照里没有的用户扩展；执行前脚本会自动生成 pre-restore 备份。

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Restore-ClaudeCodeHarness.ps1 -SnapshotPath "opencode-global-config\harness-backups\claude-code\<snapshot-id>" -Apply -PruneExtensions
```

跨电脑迁移时，下载 zip 后使用 `-ArchivePath`：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Restore-ClaudeCodeHarness.ps1 -ArchivePath ".\claude-code-harness-xxxx.zip"
```

确认 dry-run 的 `ClaudeHome` 是新电脑当前用户的 `%USERPROFILE%\.claude` 后，再执行：

```powershell
.\opencode-global-config\skills\claude-code-harness-backup-restore\scripts\Restore-ClaudeCodeHarness.ps1 -ArchivePath ".\claude-code-harness-xxxx.zip" -Apply
```

脚本按 `manifest.json` 里的 `claude_relative` 相对路径恢复到目标电脑的 `ClaudeHome`，不会把原电脑的绝对路径硬写回新电脑。`SourceClaudeHome` 只用于审计和对照。

如果新电脑还没有安装这个 skill，先解压 zip，进入快照目录后运行随包携带的脚本：

```powershell
.\restore-tools\scripts\Restore-ClaudeCodeHarness.ps1 -SnapshotPath "."
.\restore-tools\scripts\Restore-ClaudeCodeHarness.ps1 -SnapshotPath "." -Apply
```

## 安全规则

- 不输出或复制密钥值。
- 不把 `auth.json`、OAuth token、`.my_secrets.env`、`.secrets.env`、`apiKeyHelper` 所引用的密钥源文件放进快照内容。
- 备份包只包含非密钥 harness 内容；用户已经要求默认上传到指定 Google Drive 文件夹，所以备份后的 Drive 上传无需二次确认。
- 不覆盖 Claude Code 目标文件，除非用户明确选择 restore `-Apply`。
- 真正还原前必须先 dry-run，除非用户明确要求直接应用。
- 还原前自动创建 pre-restore 备份，避免二次损坏。
- 还原后重新读取 `CLAUDE.md`、`settings.json`、subagents、slash commands 和 skills 清单确认文件存在。
- 不备份 `%USERPROFILE%\.claude\projects\<path>\` 下的会话 transcript、`statsig/`、`todos/`、`shell-snapshots/`、`ide/` 临时状态，避免快照膨胀和泄露交互内容。

## 汇报格式

备份后输出：

```markdown
已创建 Claude Code harness 备份：

- 快照：`<snapshot-id>`
- 路径：`<absolute snapshot path>`
- 版本：`v1`
- 时间：`<local time>` / `<UTC time>`
- Drive 上传：`<zip link>`、`<sha256 link>`
- 独立还原说明：`<restore md link>`
- 已备份：CLAUDE.md、settings.json、keybindings.json、用户 skills、subagents、slash commands、hooks 清单
- 已排除：auth.json、token、secret env、marketplace 插件二进制、会话 transcript、statsig/todos/shell-snapshots/ide 临时状态
```

还原后输出：

```markdown
已还原 Claude Code harness：

- 来源快照：`<snapshot-id>`
- 还原文件：...
- 还原 skills / subagents / slash commands：...
- 还原 hooks：...
- 自动创建的还原前备份：...
- 仍需人工处理：账号登录态、连接器授权、外部 OAuth token、`apiKeyHelper` 脚本依赖的本地密钥源文件
```
