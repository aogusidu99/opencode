- 如需重新生成 JavaScript SDK，请运行 `./packages/sdk/js/script/build.ts`。
- 在适用的情况下，请始终使用并行工具（PARALLEL TOOLS）。
- 此仓库的默认分支是 `dev`。
- 本地可能不存在 `main` 分支；请使用 `dev` 或 `origin/dev` 查看差异（diffs）。
- 优先选择自动化操作：除非缺少必要信息或涉及到安全/不可逆操作，否则应在不询问用户确认的情况下直接执行被请求的操作。



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
- 测试不能在仓库根目录下运行（会有安全守卫拦截：`do-not-run-tests-from-root`）；请在相关的包目录（例如 `packages/opencode`）下运行测试。

## 类型检查 (Type Checking)

- 必须始终在包目录（例如 `packages/opencode`）下运行 `bun typecheck`，绝对不要直接运行 `tsc`。
