import { spawnSync } from "node:child_process"
import { basename } from "node:path"

const TIMEOUT = 5_000

type Probe = { type: "Loaded"; value: Record<string, string> } | { type: "Timeout" } | { type: "Unavailable" }

export function getUserShell() {
  return process.env.SHELL || "/bin/sh"
}

export function parseShellEnv(out: Buffer) {
  const env: Record<string, string> = {}
  for (const line of out.toString("utf8").split("\0")) {
    if (!line) continue
    const ix = line.indexOf("=")
    if (ix <= 0) continue
    env[line.slice(0, ix)] = line.slice(ix + 1)
  }
  return env
}

function probe(shell: string, mode: "-il" | "-l"): Probe {
  const out = spawnSync(shell, [mode, "-c", "env -0"], {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: TIMEOUT,
    windowsHide: true,
  })

  const err = out.error as NodeJS.ErrnoException | undefined
  if (err) {
    if (err.code === "ETIMEDOUT") return { type: "Timeout" }
    console.log(`[server] Shell env probe failed for ${shell} ${mode}: ${err.message}`)
    return { type: "Unavailable" }
  }

  if (out.status !== 0) {
    console.log(`[server] Shell env probe exited with non-zero status for ${shell} ${mode}`)
    return { type: "Unavailable" }
  }

  const env = parseShellEnv(out.stdout)
  if (Object.keys(env).length === 0) {
    console.log(`[server] Shell env probe returned empty env for ${shell} ${mode}`)
    return { type: "Unavailable" }
  }

  return { type: "Loaded", value: env }
}

export function isNushell(shell: string) {
  const name = basename(shell).toLowerCase()
  const raw = shell.toLowerCase()
  return name === "nu" || name === "nu.exe" || raw.endsWith("\\nu.exe")
}

export function loadShellEnv(shell: string) {
  if (isNushell(shell)) {
    console.log(`[server] Skipping shell env probe for nushell: ${shell}`)
    return null
  }

  const interactive = probe(shell, "-il")
  if (interactive.type === "Loaded") {
    console.log(`[server] Loaded shell environment with -il (${Object.keys(interactive.value).length} vars)`)
    return interactive.value
  }
  if (interactive.type === "Timeout") {
    console.warn(`[server] Interactive shell env probe timed out: ${shell}`)
    return null
  }

  const login = probe(shell, "-l")
  if (login.type === "Loaded") {
    console.log(`[server] Loaded shell environment with -l (${Object.keys(login.value).length} vars)`)
    return login.value
  }

  console.warn(`[server] Falling back to app environment: ${shell}`)
  return null
}

export function loadWindowsPersistentEnv() {
  if (process.platform !== "win32") return null

  const script = `
$machine = [Environment]::GetEnvironmentVariables('Machine')
$user = [Environment]::GetEnvironmentVariables('User')
$result = @{}
foreach ($key in $machine.Keys) { $result[$key] = [string]$machine[$key] }
foreach ($key in $user.Keys) { $result[$key] = [string]$user[$key] }
$result | ConvertTo-Json -Compress
`
  const out = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: ["ignore", "pipe", "ignore"],
    timeout: TIMEOUT,
    windowsHide: true,
  })

  const err = out.error as NodeJS.ErrnoException | undefined
  if (err) {
    if (err.code === "ETIMEDOUT") console.warn("[server] Windows environment probe timed out")
    else console.log(`[server] Windows environment probe failed: ${err.message}`)
    return null
  }

  if (out.status !== 0) {
    console.log("[server] Windows environment probe exited with non-zero status")
    return null
  }

  try {
    const parsed = JSON.parse(out.stdout.toString("utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string")
        .filter(([key]) => key.length > 0),
    )
  } catch {
    console.log("[server] Windows environment probe returned invalid JSON")
    return null
  }
}

export function mergeShellEnv(shell: Record<string, string> | null, env: Record<string, string | undefined>) {
  const defined = Object.fromEntries(
    // 空字符串视为"未设置":不让 process.env 里的空值覆盖 shell/持久环境探测到的有效值。
    // 典型场景:某些终端把 https_proxy 设为空串,会顶掉真正的代理,导致 GUI 应用直连外网失败。
    Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1] !== ""),
  )
  return {
    ...shell,
    ...defined,
  }
}
