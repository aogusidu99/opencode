// Hooks 演示插件 — 工具执行日志 + 自定义环境变量注入
// 通过 tool.execute.before/after 实现确定性的前后钩子

/** @type {import("@opencode-ai/plugin").PluginModule} */
export default {
  id: "hooks-logger",
  server: async (input) => {
    // 用于统计当前会话的工具调用
    const stats = new Map()

    return {
      // ── Hook 1: 工具调用前 ──
      // 记录开始时间，可用于审计或拦截
      "tool.execute.before": async (ctx, output) => {
        const now = Date.now()
        stats.set(ctx.callID, { tool: ctx.tool, start: now })

        // 示例：可以在这里修改工具参数
        // if (ctx.tool === "edit" && output.args.path?.includes("important")) {
        //   console.log(`[hooks] ⚠️ 即将编辑重要文件: ${output.args.path}`)
        // }
      },

      // ── Hook 2: 工具调用后 ──
      // 记录执行耗时，输出日志
      "tool.execute.after": async (ctx, output) => {
        const record = stats.get(ctx.callID)
        if (record) {
          const duration = Date.now() - record.start
          // 超过 5 秒的工具调用会被标记
          if (duration > 5000) {
            console.log(`[hooks] ⏱️ 慢工具: ${ctx.tool} 耗时 ${(duration / 1000).toFixed(1)}s`)
          }
          stats.delete(ctx.callID)
        }
      },

      // ── Hook 3: Shell 环境变量注入 ──
      // 每次 bash 工具执行时自动注入环境变量
      "shell.env": async (_ctx, output) => {
        output.env["OPENCODE_HOOKS"] = "active"
        // 示例：注入项目特定的环境变量
        // output.env["NODE_ENV"] = "development"
        // output.env["DEBUG"] = "opencode:*"
      },

      // ── Hook 4: 监听事件流 ──
      // 记录会话事件用于调试
      event: async ({ event }) => {
        // 可以在这里监听各种事件
        // if (event.type === "session.updated") {
        //   console.log(`[hooks] 会话更新: ${event.properties.id}`)
        // }
      },
    }
  },
}
