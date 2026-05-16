# 全局规则

## 本地文件策略 (Local File Policy)

- 文件编辑和修改的默认目录是 opencode 中当前打开的文件夹。
- 当前打开的文件夹下的文件可以直接进行编辑，无需询问。
- 在编辑或修改当前打开的文件夹以外的文件之前，请先询问用户进行确认。
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

## 交流规范 (Communication)

1. 优先使用中文进行交流。
2. 优先给出 PowerShell 中的命令并运行。
3. 重要的、本次会话前面没有出现过的代码和命令，请给出解释说明。
4. 优先使用 pnpm/bun 而非 npm。
5. 生成主要代码时加注释，解释代码的作用。
