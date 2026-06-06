#!/usr/bin/env node
/**
 * Gemini Search MCP Server
 *
 * 利用 Gemini API 的 Google Search Grounding 功能，为 OpenCode 提供实时网络搜索能力。
 * API Key 从 ~/.my_secrets.env 中读取，无需硬编码。
 *
 * 使用方式（在 opencode.json 中配置为 local MCP）：
 *   "command": ["node", "/path/to/gemini-search/server.mjs"]
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { GoogleGenAI } from "@google/genai"
import { z } from "zod"
import fs from "fs"
import path from "path"
import os from "os"

// 从 ~/.my_secrets.env 读取指定密钥
function loadSecret(key) {
  const secretsPath = path.join(os.homedir(), ".my_secrets.env")
  if (!fs.existsSync(secretsPath)) return null
  for (const line of fs.readFileSync(secretsPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    if (trimmed.slice(0, idx).trim() === key) return trimmed.slice(idx + 1).trim()
  }
  return null
}

const apiKey = loadSecret("GEMINI_API_KEY") || process.env.GEMINI_API_KEY
if (!apiKey) {
  process.stderr.write("错误: 请在 ~/.my_secrets.env 中设置 GEMINI_API_KEY\n")
  process.exit(1)
}

const ai = new GoogleGenAI({ apiKey })

function responseText(response) {
  if (typeof response.text === "function") return response.text()
  return response.text ?? ""
}

function toolError(error) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Gemini Search 调用失败：${error instanceof Error ? error.message : String(error)}`,
      },
    ],
  }
}

// 创建 MCP Server
const server = new McpServer({
  name: "gemini-search",
  version: "1.0.0",
})

// 工具1: 实时网络搜索（带引用来源）
server.tool(
  "web_search",
  "使用 Google Search 进行实时网络搜索，返回最新信息和引用来源。适用于查询近期新闻、最新文档、实时数据等。",
  { query: z.string().describe("搜索关键词或问题，支持中英文") },
  async ({ query }) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
          // 启用 Google Search Grounding：让 Gemini 实时搜索网络
          tools: [{ googleSearch: {} }],
        },
      })

      const text = responseText(response)

      // 提取引用来源
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
      const sources = chunks
        .filter((c) => c.web?.uri)
        .map((c) => `- [${c.web.title || c.web.uri}](${c.web.uri})`)
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: sources ? `${text}\n\n**参考来源:**\n${sources}` : text,
          },
        ],
      }
    } catch (error) {
      return toolError(error)
    }
  },
)

// 工具2: 深度研究（多轮搜索聚合，适合复杂问题）
server.tool(
  "deep_research",
  "对复杂问题进行深度研究，自动分解问题并搜索多个角度，返回综合分析报告。适合技术调研、方案对比等场景。",
  {
    topic: z.string().describe("研究主题或问题"),
    depth: z.enum(["brief", "detailed"]).optional().describe("研究深度：brief（快速）或 detailed（详细，默认）"),
  },
  async ({ topic, depth = "detailed" }) => {
    try {
      const prompt =
        depth === "detailed"
          ? `请对以下主题进行深度研究和综合分析，搜索最新信息，给出详细的报告（包括现状、趋势、优缺点对比、实践建议）：\n\n${topic}`
          : `请简要搜索并总结以下主题的最新信息：\n\n${topic}`

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.3,
        },
      })

      const text = responseText(response)
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
      const sources = chunks
        .filter((c) => c.web?.uri)
        .map((c) => `- [${c.web.title || c.web.uri}](${c.web.uri})`)
        .join("\n")

      return {
        content: [
          {
            type: "text",
            text: sources ? `${text}\n\n**参考来源 (${chunks.length} 个):**\n${sources}` : text,
          },
        ],
      }
    } catch (error) {
      return toolError(error)
    }
  },
)

// 启动服务（stdio 模式，供 OpenCode MCP 调用）
const transport = new StdioServerTransport()
await server.connect(transport)
