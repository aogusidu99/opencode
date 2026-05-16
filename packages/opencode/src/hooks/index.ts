export * as Hooks from "./index"
import { Effect, Context, Layer } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http"
import { Config } from "../config"
import { Log } from "../util"
import type { ConfigHooks } from "../config/hooks"

const log = Log.create({ service: "hooks" })

const DEFAULT_TIMEOUT = 10_000
const BLOCK_EXIT_CODE = 2

export interface HookEvent {
  event: ConfigHooks.Event
  tool?: string
  tool_input?: unknown
  tool_output?: unknown
  session_id?: string
  call_id?: string
}

export class BlockedError {
  readonly _tag = "HookBlocked"
  constructor(
    readonly hook: ConfigHooks.HookEntry,
    readonly message: string,
  ) {}
}

export interface Interface {
  readonly run: (
    event: ConfigHooks.Event,
    context: { tool?: string; args?: unknown; result?: unknown; sessionID?: string; callID?: string },
  ) => Effect.Effect<void, BlockedError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Hooks") {}

function matches(pattern: string, tool: string): boolean {
  try {
    return new RegExp(`^(?:${pattern})$`, "i").test(tool)
  } catch {
    return pattern === tool
  }
}

async function runCommand(command: string, payload: string, timeout: number): Promise<{ blocked: boolean }> {
  const parts = command.split(/\s+/)
  const cmd = parts[0]
  if (!cmd) return { blocked: false }

  try {
    const proc = Bun.spawn(parts, {
      stdin: new Response(payload).body,
      stdout: "ignore",
      stderr: "ignore",
    })

    const timer = setTimeout(() => {
      try {
        proc.kill()
      } catch {}
    }, timeout)

    const code = await proc.exited
    clearTimeout(timer)

    return { blocked: code === BLOCK_EXIT_CODE }
  } catch (err) {
    log.warn("hook command failed", { command, error: String(err) })
    return { blocked: false }
  }
}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const http = yield* HttpClient.HttpClient

    const runHttpHandler = Effect.fn("Hooks.runHttp")(function* (
      handler: { url: string; timeout?: number },
      payload: string,
    ) {
      const timeout = handler.timeout ?? DEFAULT_TIMEOUT
      yield* http
        .execute(
          HttpClientRequest.post(handler.url).pipe(
            HttpClientRequest.bodyText(payload, "application/json"),
          ),
        )
        .pipe(
          Effect.timeout(timeout),
          Effect.catch(() => {
            log.warn("hook http request failed", { url: handler.url })
            return Effect.succeed(undefined)
          }),
        )
      return { blocked: false }
    })

    const run: Interface["run"] = Effect.fn("Hooks.run")(function* (event, context) {
      const cfg = yield* config.get()
      const entries = cfg.hooks?.[event]
      if (!entries?.length) return

      const payload = JSON.stringify({
        event,
        tool: context.tool,
        tool_input: context.args,
        tool_output: context.result,
        session_id: context.sessionID,
        call_id: context.callID,
      } satisfies HookEvent)

      for (const entry of entries) {
        if (context.tool && !matches(entry.matcher, context.tool)) continue

        log.info("running hook", { event, tool: context.tool, matcher: entry.matcher, type: entry.handler.type })

        const handler = entry.handler
        const result =
          handler.type === "command"
            ? yield* Effect.promise(() => runCommand(handler.command, payload, handler.timeout ?? DEFAULT_TIMEOUT))
            : yield* runHttpHandler(handler, payload)

        if (result.blocked) {
          log.info("hook blocked tool execution", { event, tool: context.tool, matcher: entry.matcher })
          return yield* Effect.fail(new BlockedError(entry, `Blocked by hook: ${entry.matcher}`))
        }
      }
    })

    return Service.of({ run })
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Config.defaultLayer),
  Layer.provide(FetchHttpClient.layer),
)
