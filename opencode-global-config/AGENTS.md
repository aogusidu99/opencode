# 全局规则

## 本地文件策略 (Local File Policy)

- 文件编辑和修改的默认目录是 opencode 中当前打开的文件夹。
- 当前打开的文件夹下的文件可以直接进行编辑，无需询问。
- 在编辑或修改当前打开的文件夹以外的文件之前，请先询问用户进行确认。**例外：以下"可信工作域"路径属于用户日常配置范围，写入无需逐次询问**：
  - `D:/Code/opencode/**` — 仓库本体（含 worktrees、`opencode-global-config/`、`harness-backups/`）
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

- 除下列高危或生产相关命令外，其他 bash/shell 命令默认直接运行。
- 每次都必须手动确认：`rm -rf` / `rm -fr` / PowerShell `Remove-Item -Recurse -Force` 等高危递归删除，尤其是项目根目录以外或 `.git` 目录相关删除。
- 每次都必须手动确认：任何 `sudo` 命令。
- 每次都必须手动确认：生产环境部署与发布命令，例如 `git push origin main`、`npm publish`、`docker push`。
- 每次都必须手动确认：任何命令文本中包含 `deploy`、`prod`，或涉及云端/生产凭据的命令，例如 `aws`、`vercel`。
- 以下工具默认允许：`glob`、`grep`、`list`、`task`、`webfetch`、`websearch`。
- `external_directory` 默认允许读取/访问；写入外部目录仍遵守本地文件策略和系统权限限制。

## 交流规范 (Communication)

1. 优先使用中文进行交流。
2. 优先给出 PowerShell 中的命令并运行。
3. 重要的、本次会话前面没有出现过的代码和命令，请给出解释说明。
4. 优先使用 pnpm/bun 而非 npm。
5. 生成主要代码时加注释，解释代码的作用。

## Skills 维护策略 (Skills Maintenance Policy)

**单一来源 (Single Source of Truth)：** `D:/Code/opencode/opencode-global-config/skills/`

各 agent 的本地 skills 目录通过 Windows directory junction 链接到源，**编辑源即对所有 agent 立即生效**，避免拷贝 drift。

| Agent | 本地 skills 目录 | 链接方式 |
|-------|-----------------|---------|
| OpenCode | 直接读源（已在 `opencode.json` / 全局配置中声明 skills paths） | 无需 junction |
| Codex | `~/.codex/skills/<name>` | junction → 源 |
| Claude Code | `~/.claude/skills/<name>` | junction → 源 |
| Antigravity | 位置待运行时确认（建议 `~/.antigravity/skills/<name>`） | junction → 源 |

**新增 skill：**

1. 在 `D:/Code/opencode/opencode-global-config/skills/<skill-name>/` 创建 `SKILL.md`。
2. 为需要使用该 skill 的每个 agent 建 junction：

   ```powershell
   cmd /c mklink /J "<agent-skills-dir>\<skill-name>" "D:\Code\opencode\opencode-global-config\skills\<skill-name>"
   ```

3. Agent 专属 skill（如 `codex-*`、`claude-code-*`、`antigravity-*`）只在对应 agent 建 junction。
4. 跨 agent 通用 skill（如 `skill-creator`）所有 agent 都建 junction。

**编辑现有 skill：** 直接改源目录中的 `SKILL.md`，所有已建 junction 的 agent 立即同步，无需重复操作。

**删除 skill：** 先用 `rmdir <link-path>` 移除每个 agent 中对应的 junction，再删源目录（`rmdir` 删 junction 本身不影响源；反向顺序会留下断链）。

**Agent 专属系统目录保留为实体（不进共享源）：**

- Codex: `~/.codex/skills/.system/`、`~/.codex/skills/login-secrets/`
- 这些属于 agent 自身分发或登录态相关，不应进入跨 agent 共享。

**Junction 兼容性回退：** 若某 agent 的 skill 发现机制不跟随 junction，回退到实体拷贝模式，并在该 agent 的 rules 文件中加标记 `needs-manual-sync`，约定每次源变更后手动同步该 agent 的拷贝。

**本节是跨 agent 共享规则：** 同样的内容也在 `~/.codex/AGENTS.md`、`~/.claude/CLAUDE.md`、`~/.antigravity/AGENTS.md`（如启用）中维护；改一处后请同步其他三处。

## Harness 规则跨 agent 同步策略 (Cross-Agent Rule Sync Policy)

凡是涉及 agent harness 的全局规则（本地文件策略、密钥管理、浏览器操作、工具与命令权限、交流规范、Skills 维护策略等）的调整，**必须默认同步更新到全部 4 个 agent 的规则文件中**：

- `D:/Code/opencode/opencode-global-config/AGENTS.md`（OpenCode 源）
- `~/.codex/AGENTS.md`（Codex）
- `~/.claude/CLAUDE.md`（Claude Code）
- `~/.antigravity/AGENTS.md`（Antigravity，加载机制待验证）

**例外：** 仅在该 agent 自身运行时配置中表达的设置不强制跨 agent 同步，按各 agent 自身机制实现：

- OpenCode: `opencode.json` 的 permission 树、experimental 字段、MCP 配置
- Codex: `config.toml` 的 `sandbox_mode`、`approval_policy`、`model_reasoning_effort`、`[plugins.*]`、`[marketplaces.*]`
- Claude Code: `settings.json` 的 `hooks`、`statusLine`、`apiKeyHelper`、`mcpServers` 等专属字段
- Antigravity: `%APPDATA%/Antigravity/User/settings.json`（VS Code-fork 设置）

**执行流程：**

1. 用户提出规则调整时，先告知本次会触及哪几个文件。
2. 同步写入 4 个文件中对应段落（核心文本一致，仅文末"本节也在 X/Y/Z 中维护"提示根据上下文略调）。
3. 完成后报告 4 个文件全部更新。
4. 如某 agent 暂未启用或加载机制未验证（如 Antigravity），仍写入文件作为预置，并标注 `needs-runtime-verification`。
5. 同步完成后建议拍一次相关 agent 的 harness 备份快照，覆盖本次规则变更。

**本节是跨 agent 共享元规则（meta-rule）：** 本节本身也按上述流程同步到全部 4 个文件中；改一处即同步其他三处。
