# OpenCode

> 开源 AI 编程智能体，附带 TUI 界面。基于 Bun + TypeScript + Effect 构建。

- **运行环境 (Runtime)**: Bun
- **语言 (Language)**: TypeScript (严格模式)
- **框架 (Framework)**: Effect (函数式 effect 系统)
- **ORM**: Drizzle (SQLite)
- **代码仓库 (Monorepo)**: Turbo
- **默认分支 (Default branch)**: `dev` (本地可能不存在 `main` 分支；请使用 `dev` 或 `origin/dev` 查看差异)

## 项目结构 (Project Structure)

```
packages/
├── opencode/          ← 核心智能体 (主代码库)
│   └── src/
│       ├── agent/         Agent 定义与提示词 (prompts)
│       ├── config/        配置系统 (self-export 模式)
│       ├── plugin/        插件加载与钩子 (hooks)
│       ├── session/       聊天会话与大模型编排
│       ├── tool/          内置工具
│       └── provider/      大模型提供商适配器
├── plugin/            ← 插件 SDK (@opencode-ai/plugin)
├── sdk/               ← 客户端 SDK (JS/Go)
├── ui/                ← React UI 组件
├── web/               ← Web 应用程序
└── app/               ← Tauri 桌面应用程序
```

## 命令 (Commands)

| 任务 | 命令 | 运行目录 |
|:-----|:--------|:---------|
| 类型检查 | `bun typecheck` | 包目录 (例如 `packages/opencode`)，绝对不要直接运行 `tsc` |
| 测试 | `bun test` | 包目录 (注意不要在仓库根目录运行；有安全守卫：`do-not-run-tests-from-root`) |
| 重新生成 JS SDK | `./packages/sdk/js/script/build.ts` | 仓库根目录 |

## 工作流 (Workflow)

- 在适用的情况下，请始终使用并行工具（ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE）。
- 优先选择自动化操作：除非缺少必要信息或涉及到安全/不可逆操作，否则应在不询问用户确认的情况下直接执行被请求的操作。

### 完成标准 (Definition of Done)

一项任务只有在满足以下条件时才算完成：
1. 在相关的包目录下运行 `bun typecheck` 能够通过
2. 相关的测试运行通过 (`bun test`)
3. 没有引入新的 `any` 类型

## 本地文件策略 (Local File Policy)


## 定制化与全局配置同步 (Customization & Global Config Sync)

本项目维护的是一个经过深度定制的 OpenCode 个人版本。为了确保个人全局设置（如自定义 Agent、快捷命令、模型参数、钩子插件）能够在不同的开发设备上无缝同步，采用了以下配置架构：

1. **程序与配置分离**：无论软件以源码运行还是编译为桌面程序，OpenCode 始终遵守操作系统的 XDG 规范，固定读取系统的用户目录（在 Windows 上为 `C:\Users\<UserName>\.config\opencode`）来加载全局配置。
2. **桥接同步机制 (Dotfiles)**：
   - 本仓库内专门维护了 `opencode-global-config/` 目录，用于安全存储并利用 Git 同步个人的定制化全局配置。
   - **环境配置要求**：在新设备上 clone 本仓库后，必须使用系统级的“目录联接”将操作系统的默认配置路径桥接到源码中的这个目录，从而实现配置数据的“骗局同步”。
   - **桥接命令示例 (Windows PowerShell)**：
     ```powershell
     New-Item -ItemType Junction -Path "C:\Users\<你的用户名>\.config\opencode" -Target "<克隆路径>\opencode\opencode-global-config"
     ```
3. **配置优先级**：项目根目录下的 `.opencode/` 用于存储仅限当前代码库的“项目级”配置（例如编译脚本专用的 hook），它可以覆盖（Override）上述的全局配置。

## 代码风格指南 (Style Guide)

### 通用原则 (General Principles)

- 除非为了可组合性或可重用性，否则尽量将逻辑保持在一个函数内。
- 尽可能避免使用 `try`/`catch`。
- 避免使用 `any` 类型。
- 尽可能使用 Bun APIs，例如 `Bun.file()`。
- 尽可能依赖类型推断；除非出于导出（exports）或清晰度的必要，否则避免使用显式的类型注解或接口。
- 优先使用函数式数组方法（flatMap, filter, map）而不是 for 循环；在 filter 上使用类型守卫（type guards）以保持下游的类型推断。
- 在 `src/config` 中，添加新的配置模块时，请遵循文件顶部现有的自我导出模式（例如 `export * as ConfigAgent from "./agent"`）。

当一个值只被使用一次时，通过内联（inlining）来减少变量总数。

```ts
// 推荐 (Good)
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// 不推荐 (Bad)
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### 解构 (Destructuring)

避免不必要的解构。使用点号（dot notation）语法来保留上下文。

```ts
// 推荐 (Good)
obj.a
obj.b

// 不推荐 (Bad)
const { a, b } = obj
```

### 变量 (Variables)

优先使用 `const` 而不是 `let`。使用三元运算符或提前返回（early returns）来代替重新赋值。

```ts
// 推荐 (Good)
const foo = condition ? 1 : 2

// 不推荐 (Bad)
let foo
if (condition) foo = 1
else foo = 2
```

### 控制流 (Control Flow)

避免使用 `else` 语句。优先使用提前返回（early returns）。

```ts
// 推荐 (Good)
function foo() {
  if (condition) return 1
  return 2
}

// 不推荐 (Bad)
function foo() {
  if (condition) return 1
  else return 2
}
```

### 数据库 Schema 定义 (Drizzle)

字段名使用蛇形命名法（snake_case），这样就不需要把列名重新定义为字符串了。

```ts
// 推荐 (Good)
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// 不推荐 (Bad)
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## 测试 (Testing)

- 尽可能避免使用 mocks。
- 测试实际的实现逻辑，不要在测试代码中复制/重写业务逻辑。
