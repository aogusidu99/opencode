import http from "http"
import { exec } from "child_process"
import https from "https"
import url from "url"
import fs from "fs"
import path from "path"

// 从 ~/.my_secrets.env 读取凭证，避免硬编码敏感信息
function loadSecrets() {
  const secretsPath = path.join(process.env.USERPROFILE || process.env.HOME, ".my_secrets.env")
  if (!fs.existsSync(secretsPath)) {
    console.error(`错误: 找不到密钥文件 ${secretsPath}`)
    process.exit(1)
  }
  const lines = fs.readFileSync(secretsPath, "utf8").split("\n")
  const secrets = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    secrets[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
  return secrets
}

const secrets = loadSecrets()
const CLIENT_ID = secrets.GOOGLE_CLIENT_ID
const CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("错误: 请在 ~/.my_secrets.env 中设置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET")
  process.exit(1)
}

const REDIRECT_URI = "http://localhost:3737"
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar",
].join(" ")

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&access_type=offline` +
  `&prompt=consent`

console.log("Opening browser for Google authorization...")
console.log("Auth URL:", authUrl)

// 使用系统默认浏览器打开（不用 Puppeteer，避免 Google 登录被拦截）
const opener = process.platform === "win32" ? `start "" "${authUrl}"` : `open "${authUrl}"`
exec(opener)

// 本地服务器接收 OAuth 回调
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true)
  const code = parsed.query.code

  if (!code) {
    res.end("No code received.")
    return
  }

  res.end("<h1>Authorization successful! You can close this tab.</h1>")
  server.close()

  // 用 code 换取 tokens
  const postData = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  }).toString()

  const options = {
    hostname: "oauth2.googleapis.com",
    path: "/token",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
  }

  const tokenReq = https.request(options, (tokenRes) => {
    let data = ""
    tokenRes.on("data", (chunk) => (data += chunk))
    tokenRes.on("end", () => {
      const tokens = JSON.parse(data)
      if (tokens.error) {
        console.error("Token error:", tokens)
        return
      }
      console.log("\n=== Tokens received ===")
      console.log("GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token)
      console.log("GOOGLE_ACCESS_TOKEN=" + tokens.access_token)
      console.log("\n请将 GOOGLE_REFRESH_TOKEN 更新到 ~/.my_secrets.env 中。")

      // 将 token 保存到 MCP 期望的路径
      const tokenPath = path.join(
        process.env.USERPROFILE || process.env.HOME,
        ".config", "mcp-google-drive", "tokens.json"
      )
      fs.mkdirSync(path.dirname(tokenPath), { recursive: true })
      fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2))
      console.log(`Token 已保存到 ${tokenPath}`)
      process.exit(0)
    })
  })

  tokenReq.on("error", (e) => console.error("Request error:", e))
  tokenReq.write(postData)
  tokenReq.end()
})

server.listen(3737, () => {
  console.log("Waiting for OAuth callback on http://localhost:3737 ...")
})
