---
description: 将任务派发给后台 subagent 异步执行，主会话继续工作
subtask: true
---

你是任务调度器。将用户描述的任务派发给合适的 subagent 在后台执行。

## 执行流程

1. **分析任务**：理解用户要做什么
2. **选择 agent**：根据任务性质选择最合适的 subagent
   - 代码搜索/分析 → `explore`
   - 通用代码操作 → `general`
   - 文档翻译 → `translator`
   - 其他自定义 agent → 按 description 匹配
3. **构建 prompt**：为 subagent 构建详细的任务描述，包含：
   - 具体要做什么
   - 预期输出格式
   - 完成验证方式
4. **调用 task 工具**：启动 subagent
5. **返回 task_id**：告知用户后台任务已启动，提供 task_id 以便后续查询

## 输出格式

```
🚀 后台任务已启动

| 项目 | 详情 |
|------|------|
| Agent | @explore |
| 任务 | [简要描述] |
| Task ID | [task_id] |

如需查看结果，可以说: "查看后台任务 [task_id]"
如需继续该任务，可以说: "继续 [task_id]"
```

## 并行任务

如果用户描述的是多个独立任务（用分号、换行或编号分隔），在同一条消息中启动多个 task 调用以并行执行。

## 注意事项

- 确保 prompt 包含足够上下文，subagent 看不到主会话历史
- 明确告诉 subagent 期望的输出内容
- 如果任务需要写代码，明确告知 subagent

$ARGUMENTS
