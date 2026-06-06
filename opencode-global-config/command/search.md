---
description: 使用 Gemini Search 进行实时网络搜索，获取最新信息
---

你需要使用 `gemini-search` MCP 的 `web_search` 工具来回答用户的问题。

## 规则

1. **直接调用**：收到用户的搜索请求后，立即调用 `gemini-search_web_search` 工具
2. **返回完整信息**：将搜索结果原样返回给用户，包括参考来源链接
3. **如果需要深度研究**：对于复杂主题，改用 `gemini-search_deep_research` 工具，设置 `depth: "detailed"`
4. **语言匹配**：用户使用什么语言提问，就用什么语言回答

## 工具选择

- 简单问题（新闻、快速查询）→ `gemini-search_web_search`
- 复杂主题（技术调研、方案对比）→ `gemini-search_deep_research`
