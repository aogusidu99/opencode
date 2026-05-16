export * as ConfigHooks from "./hooks"
import { Schema } from "effect"
import { zod } from "@/util/effect-zod"
import { withStatics } from "@/util/schema"

export const CommandHandler = Schema.Struct({
  type: Schema.Literal("command").annotate({ description: "Handler type" }),
  command: Schema.String.annotate({
    description: "Shell command to execute. Receives event JSON on stdin. Exit code 2 blocks the tool.",
  }),
  timeout: Schema.optional(Schema.Number).annotate({
    description: "Timeout in milliseconds for the handler (default: 10000)",
  }),
})

export const HttpHandler = Schema.Struct({
  type: Schema.Literal("http").annotate({ description: "Handler type" }),
  url: Schema.String.annotate({
    description: "URL to POST the event JSON to",
  }),
  timeout: Schema.optional(Schema.Number).annotate({
    description: "Timeout in milliseconds for the request (default: 10000)",
  }),
})

export const Handler = Schema.Union([CommandHandler, HttpHandler]).annotate({
  discriminator: "type",
})

export const HookEntry = Schema.Struct({
  matcher: Schema.String.annotate({
    description: "Regex pattern to match tool names (e.g. 'bash', 'edit|write', '.*')",
  }),
  handler: Handler.annotate({
    description: "Handler to execute when the hook is triggered",
  }),
})

export const Event = Schema.Literals(["PreToolUse", "PostToolUse", "SessionStart", "Stop"])
export type Event = Schema.Schema.Type<typeof Event>

export const Info = Schema.Struct({
  PreToolUse: Schema.optional(Schema.mutable(Schema.Array(HookEntry))).annotate({
    description: "Hooks that run before a tool executes. Exit code 2 from a command handler blocks execution.",
  }),
  PostToolUse: Schema.optional(Schema.mutable(Schema.Array(HookEntry))).annotate({
    description: "Hooks that run after a tool executes successfully.",
  }),
  SessionStart: Schema.optional(Schema.mutable(Schema.Array(HookEntry))).annotate({
    description: "Hooks that run when a session starts.",
  }),
  Stop: Schema.optional(Schema.mutable(Schema.Array(HookEntry))).annotate({
    description: "Hooks that run when a session ends.",
  }),
}).pipe(withStatics((s) => ({ zod: zod(s) })))

export type Info = Schema.Schema.Type<typeof Info>
export type HookEntry = Schema.Schema.Type<typeof HookEntry>
export type Handler = Schema.Schema.Type<typeof Handler>
