import { describe, expect, test } from "bun:test"

import { isNushell, mergeShellEnv, parseShellEnv } from "./shell-env"

describe("shell env", () => {
  test("parseShellEnv supports null-delimited pairs", () => {
    const env = parseShellEnv(Buffer.from("PATH=/usr/bin:/bin\0FOO=bar=baz\0\0"))

    expect(env.PATH).toBe("/usr/bin:/bin")
    expect(env.FOO).toBe("bar=baz")
  })

  test("parseShellEnv ignores invalid entries", () => {
    const env = parseShellEnv(Buffer.from("INVALID\0=empty\0OK=1\0"))

    expect(Object.keys(env).length).toBe(1)
    expect(env.OK).toBe("1")
  })

  test("mergeShellEnv keeps explicit overrides", () => {
    const env = mergeShellEnv(
      {
        PATH: "/shell/path",
        HOME: "/tmp/home",
      },
      {
        PATH: "/desktop/path",
        OPENCODE_CLIENT: "desktop",
      },
    )

    expect(env.PATH).toBe("/desktop/path")
    expect(env.HOME).toBe("/tmp/home")
    expect(env.OPENCODE_CLIENT).toBe("desktop")
  })

  test("mergeShellEnv ignores undefined process values", () => {
    const env = mergeShellEnv({ HTTPS_PROXY: "http://proxy.local:8080" }, { HTTPS_PROXY: undefined })

    expect(env.HTTPS_PROXY).toBe("http://proxy.local:8080")
  })

  test("mergeShellEnv ignores empty-string process values", () => {
    // 某些终端会把 https_proxy 设为空串;不能让它顶掉探测到的有效代理
    const env = mergeShellEnv({ HTTPS_PROXY: "http://proxy.local:8080" }, { HTTPS_PROXY: "" })

    expect(env.HTTPS_PROXY).toBe("http://proxy.local:8080")
  })

  test("isNushell handles path and binary name", () => {
    expect(isNushell("nu")).toBe(true)
    expect(isNushell("/opt/homebrew/bin/nu")).toBe(true)
    expect(isNushell("C:\\Program Files\\nu.exe")).toBe(true)
    expect(isNushell("/bin/zsh")).toBe(false)
  })
})
