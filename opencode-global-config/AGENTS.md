# OpenCode 全局规则（定制版 / 权威源）

> 本文件是 OpenCode 的**定制版权威 harness 源**，位于 `D:/Code/opencode/opencode-global-config/`，由 git 仓库 `D:/Code/opencode` 管理。
> 本项目（Harness Universal）所说的「OpenCode agent」统一指向本定制版；标准加载位置 `~/.config/opencode/`（原版）是运行时部署位，由用户自行从本定制版同步/部署，加载机制由用户维护。
> 基于 `D:/Code/Harness Universal` 当前 README、references 和 `B-INTENT-IMPLEMENTATION-MATRIX.md` 实现。
> 保留 OpenCode 在 runtime config 中的专属配置、MCP servers、登录路径和 entity skills。

## 定制版 / 原版关系 (Custom vs Stock)

- 权威维护目标：`D:/Code/opencode/opencode-global-config/`（定制版，本文件所在仓库，受 git 管理）。
- 运行时加载位：`~/.config/opencode/`（OpenCode 标准位置，原版），由用户自行从定制版部署/同步；本项目文档不再以原版为维护目标。
- 凡涉及 OpenCode harness 的规则、运行时、skills 维护，一律改定制版；原版仅作为部署产物。

## 本地文件策略 (Local File Policy)

- 文件编辑和修改的默认目录是 OpenCode 当前打开的 workspace。
- 当前打开 workspace 下的文件可以直接编辑，无需逐次询问。
- 编辑或修改当前 workspace 以外的文件前，先询问用户确认。例外：以下可信工作域属于用户日常配置范围，写入无需逐次询问：
  - `D:/Code/opencode/**` - OpenCode 仓库本体（含定制版 `opencode-global-config/`）
  - `D:/Code/Harness Universal/**` - Harness Universal 仓库
  - `C:/tmp/**` - 本地临时工作区
  - `C:/Users/aogus/.claude/**` - Claude Code home
  - `C:/Users/aogus/.codex/**` - Codex home
  - `C:/Users/aogus/.antigravity/**` - Antigravity home
  - `C:/Users/aogus/.config/**` - MCP 服务器和工具配置目录
- 上述例外不覆盖安全规则：`.env*`、`.git/**`、lock 文件写入/编辑前仍需确认；高危递归删除、`sudo`、生产发布、云端/生产凭据命令仍需确认。
- 读取或查看文件通常不需要用户确认；外部目录默认允许读取，外部写入仍遵守本地文件策略。

## 密钥管理 (Secrets Management)

- 如果需要账户、密码或 API key 信息，优先静默读取 `C:/Users/aogus/.my_secrets.env`；如任务明确引用，也可以读取 `C:/Users/aogus/.secrets.env`。
- 绝对不能将密钥、密码、token、refresh token、client secret 或 API key 值输出到对话中，也不能提交到代码库。
- 备份和恢复只保留密钥路径引用和使用规则，不复制 credential 文件内容；OAuth 登录态和 token 跨设备恢复后重新授权。
- OAuth credential / token 文件（如 `gdrive-credentials.json`、`gdrive-token-result.json`）不进入版本库，已在 `.gitignore` 中排除。

## 浏览器操作规范 (Browser Operations)

- 凡是需要用户登录 Google 账号的操作，例如 OAuth 授权、API 启用、账号连接，禁止使用 Puppeteer 或自动化 Chromium，必须用 `Start-Process` 打开系统默认浏览器。
- `Start-Process` 打开系统默认浏览器、文件或 GUI 程序属于默认允许；涉及 Google 登录/OAuth/API 启用时必须使用系统默认浏览器。
- Puppeteer 或自动化浏览器仅用于不需要 Google 登录的普通页面自动化。

## 工具与命令权限策略 (Tool & Command Permissions)

- 除高危或生产相关命令外，普通 Bash/PowerShell/shell 命令默认可以直接运行；OpenCode runtime 的 permission、系统指令和工具权限仍拥有最终执行权。
- 打开 GUI 程序、文件或系统默认浏览器的命令默认允许。
- 每次都必须确认：`rm -rf`、`rm -fr`、PowerShell `Remove-Item -Recurse -Force` 等高危递归删除，尤其是项目根目录以外或 `.git` 目录相关删除。
- 每次都必须确认：任何 `sudo` 命令。
- 每次都必须确认：生产环境部署与发布命令，例如 `git push origin main`、`npm publish`、`docker push`。
- 每次都必须确认：任何命令文本中包含 `deploy`、`prod`，或涉及云端/生产凭据的命令，例如 `aws`、`vercel`。
- 每次都必须确认：会丢弃用户改动的 Git 操作，例如 `git reset --hard`、`git checkout -- <file>` 等覆盖或丢弃未提交改动的操作。
- 不得擅自 revert 用户已有改动，除非用户明确要求。
- `.env*` 文件、`.git/**` 目录、lock 文件（`*lock*`、`*lockb*`、`pnpm-lock.yaml` 和其它 lock 文件）不自动写入/修改，写入或编辑前必须先获得用户确认；OpenCode 用 `opencode.json` 的 `permission` ask 表达。
- **Agent harness 敏感文件：** `CLAUDE.md`、`AGENTS.md`、`settings.json`、`settings.local.json`、`config.toml`、`opencode.json`、backup/restore skills 等可以按用户明确需求批量、明确、可审计地修改；如果某 agent runtime 强制确认，不能绕过。

### 报警类操作 (Alert-class Operations)

报警类操作可以直接执行，不逐次询问，但任务完成时必须在回复中列出报警项、主要影响和建议复核点。报警类不覆盖必须确认规则；如果同一操作同时命中必须确认规则，以确认为准。

纳入报警类的操作：

- 联网获取或更新代码（不涉及生产发布或凭据）：`git fetch`、`git pull --ff-only`、`git clone` 到 workspace / 可信工作域 / 临时目录，公开资源下载。
- 依赖安装与同步：`pnpm install`、`bun install`、`uv sync`、`pip install` 等；若会写入 lock 文件，必须停止并先获得用户确认。
- 可信工作域内、但当前 workspace 外的写入。
- Agent harness 敏感文件的显式修改。
- 启动后台服务、dev server、预览服务或 GUI 程序。
- MCP / connector / plugin / extension 的注册、启用、禁用或配置更新。
- 显式 backup / restore apply（restore apply 必须是用户明确请求）。
- 创建或更新持久化任务（cron / monitor / automation）。
- 删除临时文件、缓存或构建产物（不使用高危递归强删）。

报警输出应包含：执行了什么命令/工具、为什么归入报警类、主要影响范围、建议复核点。

## 交流规范 (Communication)

1. 优先使用中文交流。
2. 优先给出 PowerShell 中的命令并运行。
3. 重要的、本次会话前面没有出现过的代码和命令，应给出简短解释。
4. 优先使用 pnpm/bun 而非 npm。
5. 生成主要代码时加必要注释，解释代码的作用。
6. 遇到仓库实际状态和文档冲突时，先说明冲突，再按 `README.md`、B 类 reference、实现矩阵和用户最新指令处理。

## Skills 维护策略 (Skills Maintenance Policy)

**A 类共享源：** `D:/Code/Harness Universal/skills/`

- 当前 A 类共享 skill 只有 `skills/skill-creator`，由 git 管理。
- 定制版 OpenCode 的 `opencode-global-config/skills/skill-creator` 应为 junction，目标指向 `D:/Code/Harness Universal/skills/skill-creator`。
- 编辑 A 类共享 skill 时，只改 `D:/Code/Harness Universal/skills/<name>/` 源目录；各 agent junction 自动读取。
- A 类共享 skill 不进入 backup 内容；backup 只记录 junction path、target、有效性和源 repo commit/branch。

**B 类 OpenCode entity skills：**

- 定制版 OpenCode 专属或目标为 OpenCode 的 skills 保留在 `opencode-global-config/skills/` 下，例如：
  - `opencode-global-config/skills/opencode-harness-backup-restore`
- backup/restore 等 B 类 entity skills 按 agent 分别实现并纳入对应 agent backup，不放入本仓库 `skills/` 作为共享源。
- 其它 agent（Codex / Claude Code / Antigravity）的 entity skills 不应保留在定制版 OpenCode skills 目录中；历史遗留副本待清理。

## Junction 与非 Junction 配置编辑策略

- Junction 文件（当前主要是 A 类 `skill-creator`）：改源文件即可，不逐 agent 复制。
- 非 junction 文件（规则、运行时配置、B 类 entity skills）：各 agent 各有独立本地文件，内容因 agent 特性而异；按用户意图分别修改。
- OpenCode 规则文件：`D:/Code/opencode/opencode-global-config/AGENTS.md`（定制版权威源）。
- OpenCode runtime：`D:/Code/opencode/opencode-global-config/opencode.json`。
- OpenCode backup 输出：`D:/Code/Harness Universal/backups/opencode/<backup-id>/`，不得散放在 `backups/opencode/` 根下。

## Harness 规则跨 agent 同步策略

凡是涉及 agent harness 的全局规则调整，默认应按 `D:/Code/Harness Universal/README.md`、`references/*.md` 和 `B-INTENT-IMPLEMENTATION-MATRIX.md` 同步检查全部 4 个 agent 的规则文件及跨 agent 参考文档：

- `D:/Code/opencode/opencode-global-config/AGENTS.md`（OpenCode 定制版权威源）
- `~/.codex/AGENTS.md`（Codex）
- `~/.claude/CLAUDE.md`（Claude Code）
- `~/.antigravity/AGENTS.md`（Antigravity，加载机制待验证）
- `D:/Code/Harness Universal/AGENTS.md`、`README.md`、`references/*.md`、`B-INTENT-IMPLEMENTATION-MATRIX.md`（按变更类型维护）

仅在某个 agent 自身运行时配置中表达的设置不强制逐字跨 agent 同步。若用户明确要求只更新某个 agent，只更新该 agent 的实现文件，但仍应说明其它 agent 可能存在待同步 drift。

## MCP / Tool 能力现状

- 定制版 OpenCode runtime config（`opencode.json`）已启用 Google Drive、Gmail、Google Calendar 和 `gemini-search`。
- `gemini-search` 脚本指向定制版自包含路径 `D:/Code/opencode/opencode-global-config/mcp-scripts/gemini-search/server.mjs`。
- browser / page automation、docs / sheets / slides 的等价能力未在当前 OpenCode runtime config 中验证到；按 B 类规则记录为能力 gap，不能伪装已实现。
- Google OAuth 和 Google 登录必须遵守系统默认浏览器规则；OAuth token 和 credential 值不进入备份。
