export type ConfigInvalidError = {
  name: "ConfigInvalidError"
  data: {
    path?: string
    message?: string
    issues?: Array<{ message: string; path: string[] }>
  }
}

export type ProviderModelNotFoundError = {
  name: "ProviderModelNotFoundError"
  data: {
    providerID: string
    modelID: string
    suggestions?: string[]
  }
}

type Translator = (key: string, vars?: Record<string, string | number>) => string

function tr(translator: Translator | undefined, key: string, text: string, vars?: Record<string, string | number>) {
  if (!translator) return text
  const out = translator(key, vars)
  if (!out || out === key) return text
  return out
}

// 网络/连接层失败的特征(请求根本没拿到 HTTP 响应):DNS、超时、连接被拒、代理不可达、undici 错误等。
// 典型症状就是用户遇到的"连不上":没走代理直连被墙的 provider 端点时会命中这些。
const CONNECTION_PATTERNS = [
  /fetch failed/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  /getaddrinfo/i,
  /connect timeout/i,
  /socket hang ?up/i,
  /other side closed/i,
  /\bterminated\b/i,
  /UND_ERR/i, // undici 抛出的错误码前缀
  /network error/i,
  /\bproxy\b/i,
  /timed? ?out/i,
]

// 认证/授权失败:key 无效、未登录、被拒。
const AUTH_PATTERNS = [
  /unauthorized/i,
  /forbidden/i,
  /invalid.*api[_ -]?key/i,
  /missing.*api[_ -]?key/i,
  /authentication/i,
]

function pick(error: unknown, key: string): unknown {
  if (!error || typeof error !== "object") return undefined
  const o = error as Record<string, unknown>
  if (key in o) return o[key]
  // 服务端错误常包成 { name, data: { message, statusCode } },也顺带看一层 data
  const data = o.data
  if (data && typeof data === "object" && key in (data as Record<string, unknown>)) {
    return (data as Record<string, unknown>)[key]
  }
  return undefined
}

function rawMessageOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.message || undefined
  if (typeof error === "string") return error || undefined
  const m = pick(error, "message")
  return typeof m === "string" && m ? m : undefined
}

function statusCodeOf(error: unknown): number | undefined {
  const s = pick(error, "statusCode") ?? pick(error, "status")
  return typeof s === "number" ? s : undefined
}

/**
 * 把"网络/代理不可达"和"认证失败"这类底层错误翻译成清晰、可操作的一句话提示。
 * 识别不出已知类别时返回 undefined,让调用方回退到原始错误文本。
 */
export function readableConnectionError(
  input: { message?: string; statusCode?: number },
  translator?: Translator,
): string | undefined {
  const status = input.statusCode
  const msg = input.message ?? ""
  if (status === 401 || status === 403 || AUTH_PATTERNS.some((p) => p.test(msg))) {
    return tr(
      translator,
      "error.chain.authRequired",
      "Authentication failed — check the provider's API key or sign-in.",
    )
  }
  // 有明确 HTTP 状态码说明请求已到达服务器,不属于"连不上"的网络层问题
  if (status === undefined && CONNECTION_PATTERNS.some((p) => p.test(msg))) {
    return tr(
      translator,
      "error.chain.networkUnreachable",
      "Can't reach the provider — check your network or proxy settings.",
    )
  }
  return undefined
}

export function formatServerError(error: unknown, translate?: Translator, fallback?: string) {
  if (isConfigInvalidErrorLike(error)) return parseReadableConfigInvalidError(error, translate)
  if (isProviderModelNotFoundErrorLike(error)) return parseReadableProviderModelNotFoundError(error, translate)

  // 先尝试给出清晰原因(网络/代理 vs 认证),命中则把原始错误作为附注保留,方便排查
  const raw = rawMessageOf(error)
  const readable = readableConnectionError({ message: raw, statusCode: statusCodeOf(error) }, translate)
  if (readable) return raw && raw !== readable ? `${readable}\n${raw}` : readable

  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  if (fallback) return fallback
  return tr(translate, "error.chain.unknown", "Unknown error")
}

function isConfigInvalidErrorLike(error: unknown): error is ConfigInvalidError {
  if (typeof error !== "object" || error === null) return false
  const o = error as Record<string, unknown>
  return o.name === "ConfigInvalidError" && typeof o.data === "object" && o.data !== null
}

function isProviderModelNotFoundErrorLike(error: unknown): error is ProviderModelNotFoundError {
  if (typeof error !== "object" || error === null) return false
  const o = error as Record<string, unknown>
  return o.name === "ProviderModelNotFoundError" && typeof o.data === "object" && o.data !== null
}

export function parseReadableConfigInvalidError(errorInput: ConfigInvalidError, translator?: Translator) {
  const file = errorInput.data.path && errorInput.data.path !== "config" ? errorInput.data.path : "config"
  const detail = errorInput.data.message?.trim() ?? ""
  const issues = (errorInput.data.issues ?? [])
    .map((issue) => {
      const msg = issue.message.trim()
      if (!issue.path.length) return msg
      return `${issue.path.join(".")}: ${msg}`
    })
    .filter(Boolean)
  const msg = issues.length ? issues.join("\n") : detail
  if (!msg) return tr(translator, "error.chain.configInvalid", `Config file at ${file} is invalid`, { path: file })
  return tr(translator, "error.chain.configInvalidWithMessage", `Config file at ${file} is invalid: ${msg}`, {
    path: file,
    message: msg,
  })
}

function parseReadableProviderModelNotFoundError(errorInput: ProviderModelNotFoundError, translator?: Translator) {
  const p = errorInput.data.providerID.trim()
  const m = errorInput.data.modelID.trim()
  const list = (errorInput.data.suggestions ?? []).map((v) => v.trim()).filter(Boolean)
  const body = tr(translator, "error.chain.modelNotFound", `Model not found: ${p}/${m}`, { provider: p, model: m })
  const tail = tr(translator, "error.chain.checkConfig", "Check your config (opencode.json) provider/model names")
  if (list.length) {
    const suggestions = list.slice(0, 5).join(", ")
    return [body, tr(translator, "error.chain.didYouMean", `Did you mean: ${suggestions}`, { suggestions }), tail].join(
      "\n",
    )
  }
  return [body, tail].join("\n")
}
