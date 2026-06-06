---
name: skill-creator
description: 从对话历史、重复工作流、仓库流程、MCP/tool 集成或已有 skill 草稿中创建、审阅、安装和迭代 Codex/OpenCode 的 SKILL.md。用户要求“把这件事做成 skill”“总结过去对话为可复用 skill”“把 Anthropic/Claude skill 改造成 Codex/OpenCode 版本”“选择全局或项目级 skill 位置”“验证触发描述”“更新 skill 且避免过拟合”时使用。Keywords: create skill, review skill, install skill, conversation to skill.
---

# Codex/OpenCode Skill 创建器

把已经证明有价值的工作方式沉淀成可复用的 SKILL.md。这个 skill 的目标不是把对话机械压缩成提示词，而是捕捉“为什么这样做、什么时候触发、怎样验证、哪些风险要避开”，让未来的 Codex 或 OpenCode 在类似任务里少走弯路。

## 核心原则

- **先理解意图，再写文件**：优先从当前对话、项目配置、已发生的修正和用户偏好中提取答案。
- **保持技能轻量**：SKILL.md 放核心流程；长参考、脚本、模板分别放进 `references/`、`scripts/`、`assets/`，并只在正文里清楚指向。
- **描述要能触发**：frontmatter 的 `description` 是主要触发入口，要写清“做什么”和“什么时候用”，包含常见同义说法和边界场景。
- **解释原因，少写僵硬口号**：对模型说明为什么要这么做，通常比堆叠绝对规则更稳。
- **不制造惊喜**：不要把隐藏联网、凭据读取、数据外传、危险命令或和技能描述不一致的行为塞进 skill。
- **先给审阅版**：除非用户明确要求安装，默认先在当前工作区创建草稿供审阅。

## 工作流程

### 1. 捕捉意图
先从对话和仓库里提取这些信息：
- 用户想重复使用的任务是什么。
- 触发它的自然语言说法有哪些，包括中文、英文、缩写、随口说法。
- 已经验证过的命令、工具、MCP、文件路径、配置位置是什么。
- 用户纠正过哪些点，这些往往是 skill 最有价值的规则。
- 成功输出应该长什么样：文件、总结、代码改动、表格、检查清单、截图或测试结果。
- 哪些安全边界不能越过：密钥、外部目录写入、生产部署、浏览器登录、危险删除等。

如果信息不够，最多问 3 个短问题。优先问：
1. 这个 skill 应该是 Codex 全局、OpenCode 全局，还是当前项目专用？
2. 你希望哪些说法触发它？
3. 你你怎么判断它做得好？

### 2. 选择目录和兼容范围
根据用户意图选择目标位置：
- **审阅草稿**：优先放在当前 workspace，例如 `skills/<skill-name>/SKILL.md` 或项目约定的草稿目录。
- **Harness Universal A 类共享 skill**：放在 `D:/Code/Harness Universal/skills/<skill-name>/SKILL.md`。当前共享源只用于可跨 agent 同源维护的 skill，例如 `skill-creator`。
- **OpenCode 全局 entity skill**：放在定制版 `D:/Code/opencode/opencode-global-config/skills/<skill-name>/SKILL.md`（权威源）；运行时部署到 `~/.config/opencode/skills/` 由用户自行同步。
- **OpenCode 项目级**：放在当前项目 `.opencode/skills/<skill-name>/SKILL.md`。
- **Codex 全局**：放在 `$CODEX_HOME/skills/<skill-name>/SKILL.md`；如果没有 `CODEX_HOME`，使用 `%USERPROFILE%\.codex\skills\<skill-name>\SKILL.md`。

写入当前工作区外的 Codex 全局目录前，先向用户确认，除非用户已经明确要求“安装到全局”。

如果 skill 属于 backup/restore、agent 专属登录或系统能力，按 B 类 entity skill 处理，保留在目标 agent 自己的 skills 目录中，不放入 `D:/Code/Harness Universal/skills/` 作为共享源。

为了兼容 Codex、OpenCode 和 Anthropic 风格 of Agent Skills，默认只使用这两个 frontmatter 字段。description 可以保留少量英文关键词，但正文说明应中文优先：
```yaml
---
name: kebab-case-name
description: 这个 skill 做什么、什么时候触发。可以附带少量 English keywords.
---
```
只有用户或目标平台明确需要时，才加入额外 metadata。

### 3. 设计 skill内容
采用这个结构，按需要删减：

# Skill 标题

一句话说明这个 skill 帮未来的 agent 避免什么重复工作。

## 工作流程

1. 分析...
2. 准备...
3. 执行...
4. 验证...
5. 汇报...

## 验证

- 运行...
- 检查...

## 输出

使用这个结构：
...

## 示例

输入：...
输出：...

## 安全边界

- ...

正文用祈使句，直接告诉未来 agent 怎么做。每条规则尽量带一点原因，尤其是用户曾经纠正过的地方。

### 4. 判断是否需要资源目录
只在真正节省重复劳动时添加资源：
- `scripts/`：重复、脆弱、需要稳定执行的代码，例如格式转换、验证器、批量文件处理。
- `references/`：超过正文承载能力的说明，例如 API 文档、配置矩阵、路径约定、故障排查表。
- `assets/`：模板、示例文件、图标、字体、deck/spreadsheet/docx 模板等输出素材。

不要创建 `README.md`、`INSTALLATION_GUIDE.md`、`CHANGELOG.md` 这类旁支文档。skill 文件夹只放未来 agent 真会用到的东西。

### 5. 写触发描述
description 同时解决两件事：识别相关任务，避免误触发。

好的描述包含：
- **动作**：create, review, install, debug, migrate, summarize, edit 等。
- **领域**：Codex/OpenCode、MCP、Google OAuth、TUI keybinds、spreadsheet charts 等。
- **触发语境**：用户可能怎么说。
- **边界**：什么时候不要用，或与相邻 skill 如何区分。

改写描述时，用小型触发评估表：

Should trigger:
- "把刚才 Gemini Search MCP 的排错流程做成 skill"
- "沉淀一下 OpenCode 全局配置同步规则"

Should not trigger:
- "解释什么是 MCP"
- "帮我临时改一个快捷键，不需要保存成流程"

如果该触发的没触发，增加具体语境和同义说法。如果不该触发的触发了，删掉过宽的关键词。

### 6. 验证
最低验证：
- 文件名是 `SKILL.md`。
- skill 目录名和 name 都是 kebab-case。
- frontmatter 有 `---` 包裹，且至少包含 `name`、`description`。
- `description` 写了“做什么”和“什么时候用”。
- 正文没有密钥、token、个人敏感值。
- 正文能让一个没有当前对话上下文的 agent 执行。
- 所有路径都符合 Codex/OpenCode 的本地文件策略。

功能验证：
- 准备 2-3 个真实触发提示和 1-2 个近似但不该触发的提示。
- 如果用户只要审阅，直接列出测试提示，不强行运行。
- 如果用户要求测试，并且当前环境支持并允许并行验证，可以用独立子任务或新会话测试；否则在当前会话做轻量模拟。
- 对比输出时看三件事：是否更快、是否少犯已知错误、是否更接近用户偏好。

### 7. 迭代
根据测试和用户反馈改 skill：
- 把一次性细节删掉。
- 把反复出现的代码或命令沉淀成脚本。
- 把太长的背景移到 `references/`。
- 把过窄的例子抽象成原则。
- 把用户纠正过的错误写成带原因的注意事项。

不要为了通过少数测试样例而过拟合。skill 应该服务一类任务，不是复刻一次对话。

## 交付格式
创建或更新 skill 后，用这个格式汇报：

已创建/更新 skill 草稿：
- 名称：`<skill-name>`
- 路径：`<absolute/path/to/SKILL.md>`
- 范围：Codex 全局 / OpenCode 全局 / 项目级 / 审阅草稿
- 触发重点：...
- 主要流程：...
- 建议测试提示：
  1. ...
  2. ...

如果只是供审阅，不要自动安装到用户目录。用户确认后，再同步到对应全局位置。

## 示例

**输入**：“把这次 Gemini Search MCP 修复流程做成 skill。”
**输出**：创建 `gemini-search-mcp-debug/SKILL.md`，包含 API key 读取策略、`@google/genai` `response.text` 属性兼容、`config.tools` 的 grounding 写法、MCP 客户端 smoke test、不要输出密钥的规则。

**输入**：“以后改 OpenCode TUI 快捷键 and 选择文本追问都按这套来。”
**输出**：创建 `opencode-tui-customization/SKILL.md`，包含要查的文件、默认快捷键冲突检查、`tsgo --noEmit` 验证、重启 TUI 后生效的提醒。
