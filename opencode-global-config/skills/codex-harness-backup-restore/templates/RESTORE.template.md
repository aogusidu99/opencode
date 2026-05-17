# Codex Harness 还原说明

- 快照：`{{SNAPSHOT_ID}}`
- 版本：`{{VERSION}}`
- 本地时间：`{{LOCAL_TIME}}`
- UTC 时间：`{{UTC_TIME}}`
- Codex Home：`{{CODEX_HOME}}`

## 已备份

- `AGENTS.md`
- `config.toml`
- `rules/`
- 用户自定义 `skills/`（不含 `.system`）
- `restore-tools/`：随快照携带的备份/还原脚本和 skill 说明

## 只记录路径，不复制内容

- `auth.json`
- `cap_sid`
- `.sandbox-secrets`
- `.my_secrets.env`
- `.secrets.env`
- Google / Gmail / Calendar OAuth token 与 credential 文件

## 还原命令

进入本快照目录后，可直接使用随快照携带的还原脚本。先 dry-run：

```powershell
.\restore-tools\scripts\Restore-CodexHarness.ps1 -SnapshotPath "."
```

确认后应用：

```powershell
.\restore-tools\scripts\Restore-CodexHarness.ps1 -SnapshotPath "." -Apply
```

如果当前电脑已经安装这个 skill，也可以不解压地直接从 zip 预演：

```powershell
.\opencode-global-config\skills\codex-harness-backup-restore\scripts\Restore-CodexHarness.ps1 -ArchivePath ".\{{ARCHIVE_NAME}}"
```

确认后应用：

```powershell
.\opencode-global-config\skills\codex-harness-backup-restore\scripts\Restore-CodexHarness.ps1 -ArchivePath ".\{{ARCHIVE_NAME}}" -Apply
```

跨电脑迁移时，默认恢复到当前 Windows 用户的 `%USERPROFILE%\.codex`，不会使用原电脑的绝对路径。需要恢复到其他位置时显式传入 `-CodexHome`。

上传到 Google Drive 文件夹：

```powershell
.\restore-tools\scripts\Upload-CodexHarnessArchiveToDrive.ps1 -ArchivePath ".\{{ARCHIVE_NAME}}" -RestoreGuidePath ".\{{SNAPSHOT_ID}}.RESTORE.md" -DriveFolderUrl "{{DRIVE_FOLDER_URL}}"
```

如需让用户自定义 skills 精确回到快照状态：

```powershell
.\restore-tools\scripts\Restore-CodexHarness.ps1 -SnapshotPath "." -Apply -PruneSkills
```
