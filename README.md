# User Modeling & Global Context Management

**给 LLM 一个持续更新的用户模型 + 全局上下文管理，比给它记忆更有效。**

---

## 为什么不是"记忆系统"

普通的记忆系统回答一个问题："用户说过什么？"

这个管线回答另一个问题：**"用户是什么样的人，现在处于什么状态，有什么思维模式？"**

区别在于——记忆系统把对话历史切成碎片存起来，检索时拼回去。用户建模管线把这些碎片**合成为一个持续演化的数字孪生**，注入到每次对话的上下文里。

这不是语义上的区别，是架构上的。在元认知和情绪处理场景中，一个预先构建好的用户模型比临时检索的记忆片段有效得多——因为理解一个人需要的不是他上周说过的那句话，而是"他是谁"这个完整画像。

## 它是怎么工作的

三条管线，首尾相连：

```
对话消息
  ↓
胶囊提取（DeepSeek Flash, 每次 cron 触发）
  ├── Experience Capsules: 用户和他者/世界的交互
  └── Internal Info Capsules: 用户的价值观、世界观、偏好、思想
  ↓
管线一（每日）：用户画像生成（DeepSeek Pro）
  ├── fact_layer:      基本信息（年龄、职业、目标）
  ├── project_status:  项目名称、阶段、进展、困难
  └── current_status:  当下状态（3个月尺度）+ 最近活动
  ↓
管线二（每周）：用户特质生成（DeepSeek Pro）
  └── pattern_layer:   内在特质和思想模式（褒义描述）
  ↓
注入 Layer 1（静态上下文，进入 prompt cache 断点之前）
  └── 每次对话时，画像全量注入，让 LLM 从一开始就"认识"用户
```

**检索是辅助的**：当用户提到具体事件时，混合检索（实体匹配 + 向量相似度 + 重要性加权）从胶囊中捞出相关事实注入。但检索服务于建模，不是反过来。

## 目录结构

```
schema/
  tables.sql           — user_experiences, user_internal_info, user_profiles 表定义
  triggers.sql         — raw_content 自动合并触发器
  hybrid-search.sql    — PostgreSQL 混合检索函数（entity + vector + significance）

pipelines/
  capsule-extractor.ts — 从对话中提取两种胶囊（DeepSeek Flash）
  daily-profile.ts     — 管线一：每日画像生成（事实层 + 状态层）
  weekly-traits.ts     — 管线二：每周特质生成（模式层）

retrieval/
  hybrid-search.ts     — 混合检索客户端
  keyword-extractor.ts — 中文关键词提取（Segment 分词 + 正则回退）
  embedding.ts         — Qwen text-embedding-v3 封装
  context-assembler.ts — 上下文组装器（画像 + 长期记忆 + 工作记忆）

prompts/
  capsule-extractor.md — 胶囊提取 prompt（含示例，供阅读和调试用）
  profile-generator.md — 画像生成 prompt
  traits-generator.md  — 特质生成 prompt
  注：实际运行的 prompt 在各管线文件的常量中，.md 是带注释的参考版本

types/
  index.ts             — 核心类型定义
```

## 核心设计决策

### 1. 异步建模，同步注入

用户模型不在对话中实时更新。每次对话结束后，工作记忆（本轮摘要）存入 Session。胶囊在每日 cron 中批量提取。画像在每日/每周 cron 中更新。

这意味着**今天说的话，最快明天才进入用户模型**。这是有意为之——实时建模会引入噪声和成本，而且需要对话结束后才能看到完整上下文。代价是新鲜度损失，收益是模型质量。

### 2. 经历与内在信息分离

两种胶囊从同一个对话中提取，但存入不同的表，走不同的检索路径。

- **经历胶囊**：客观事件，"发生了什么"——第三人称叙述，新闻风格
- **内在信息胶囊**：主观特质，"用户是谁"——价值观、偏好、思想模式

这个分离让检索时可以选择性注入——做决策支持时更需要经历，做情绪处理时更需要内在信息。

### 3. 混合检索偏实体

默认权重是 entity 0.7 / vector 0.2 / significance 0.1。

实体匹配（ILIKE 精确匹配 topic_tag 和 narrative 中的关键词）权重最高，因为用户想找回的具体记忆通常包含明确的实体——人名、地名、项目名。向量相似度作为兜底，抓到语义相近但表述不同的事件。

### 4. 画像全量注入静态层

用户画像在 Layer 1（System Prompt 后面的第一个静态块），全量注入，不在检索时按需选择。

这个决策的理由是：LLM 需要完整的用户模型才能做出好的判断。选择性注入（"只注入相关部分"）的假设是系统知道哪部分相关——但相关性的判断本身需要对用户的理解，这是一个循环依赖。

## 已知局限

### 异步延迟
胶囊在每日 cron 中提取，画像在 cron 中更新。今天发生的事最快明天才进入用户模型。对于需要即时记忆更新的场景，需要补充实时工作记忆机制。

### Prompt Cache 命中率
用户画像放在静态层，但工作记忆每轮变化。在 Anthropic 的 cache_control 方案中，缓存断点之后的所有内容（工作记忆 + 长期记忆 + 历史 + 当前消息）都失效。实际 cache 命中主要发生在同一轮内的重试。

### 关键词提取是规则的
没有用 embedding 或 LLM 做关键词提取，用的是 Node Segment 中文分词 + 停用词过滤 + 正则回退。对中文有效，对英文和多语言覆盖不足。

### 检索没有时间衰减
三年前的记忆和昨天的记忆，在满足关键词匹配和向量相似度时权重相同。没有 recency boost，也没有记忆衰减曲线。

### 工作记忆与长期记忆割裂
工作记忆（存入 Session）和长期记忆胶囊（存入 user_experiences/user_internal_info）是两套独立系统。工作记忆不参与胶囊生成，胶囊不参与工作记忆生成。两者唯一的共同点是都注入到对话上下文。

## 依赖

- **DeepSeek API** — 胶囊提取（flash）+ 画像生成（pro）
- **阿里云 DashScope (Qwen)** — text-embedding-v3, 1024 维
- **Supabase + pgvector** — 存储 + HNSW 向量索引 + RPC 函数
- **Node Segment** — 中文分词（可选，有纯 JS 回退）

## 许可

This project is licensed under the Business Source License (BSL) — see [LICENSE](./LICENSE) for details.

tl;dr: Free for non-production use, evaluation, and research. Commercial production use requires a license.
