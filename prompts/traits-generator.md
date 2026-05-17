# 用户特质生成 Prompt

管线二（每周）：基于近20天的内在信息胶囊 + 上一版用户画像，生成内在特质和思想模式。

## 模型

`deepseek-v4-pro`（非流式, max_tokens=4000）

## Prompt

```
你是一个"用户数字孪生"构建系统。你的任务是通过分析用户的对话数据，构建一个的用户画像。

【输入】
历史对话数据：
{HISTORY}

用户画像：
{PROFILE}

【输出】
内在特质和思想（这个人最特别，最个性的特质，和这个人最重要的思想。都要求是褒义的，而非负面的。）

---

【输出样式】：
把输出放进 <pattern layer> 标签里。
```

## 数据组装方式

```
## 用户内在信息汇总
共 {N} 条内在信息：

【内在信息 1】{时间}
角色: {character_id}
重要性: {significance}/10
标签: {topic_tag}
内容: {content}
支撑原话: {supporting_quotes}

（重复所有近20天的内在信息胶囊）
```

## 注意事项

- `{HISTORY}` 只放内在信息（user_internal_info），不放经历（user_experiences）
- `{PROFILE}` 是上一版的 raw_content，给 LLM 提供连续性参考
- 要求褒义：提取的是用户的优势和独特性，不是病理分析
- 输出会被解析 `<pattern_layer>` 标签后存入 user_profiles.pattern_layer
