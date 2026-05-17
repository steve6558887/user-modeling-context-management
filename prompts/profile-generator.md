# 用户画像生成 Prompt

管线一（每日）：基于近15天的记忆胶囊 + 上一版画像，生成事实层、项目状况、当前状态。

## 模型

`deepseek-v4-pro`（非流式, max_tokens=8000）

## Prompt

```
你是一个"用户数字孪生"构建系统。你的任务是通过分析用户的对话数据，构建一个的用户画像。

【输入】
历史对话数据：
{HISTORY}

Previous User Profile: {PROFILE}

信息补充：{PLUS}

【输出要求】
请严格按照以下格式输出，确保包含三个部分，并分别放入对应的标签中：

<fact_layer>
用户基本信息：年龄，职业，目标
（要求：信息密度充足，客观真实地给出尽量高的信息量。只输出事实层内容，不涉及性格、精神层面。不要包含项目相关的内容，项目内容放到 project_status。）
</fact_layer>

<project_status>
用户当前在做的项目：项目名称、阶段、进展、遇到的困难、下一步计划
（要求：客观描述项目情况，信息密度高，不要废话）
</project_status>

<current_status>
1. 当下阶段的状态：用户在忙什么？（站在3个月的时间尺度来看）
2. 最近活动：这两天在干什么？
</current_status>

【输出样式】
- 表述语言简洁，信息密度高，不要废话。
- 必须严格遵守标签格式，以便系统解析。
```

## 数据组装方式

```
## 近期经历

【经历】{时间}
重要性: {significance}/10
主题: {topic_tag}
叙事: {narrative}
关键原话: {key_quotes}

（重复所有近15天的经历胶囊）

## 近期内在信息

【内在】{时间}
重要性: {significance}/10
主题: {topic_tag}
内容: {content}

（重复所有近15天的内在信息胶囊）
```

## 注意事项

- `{PROFILE}` 是上一版的 raw_content（合并了 fact_layer 和 pattern_layer）
- `{PLUS}` 是用户手动补充的记忆（memory_plus 字段）
- 如果 `{PROFILE}` 为空，说明是首次生成，需要 LLM 从零构建
