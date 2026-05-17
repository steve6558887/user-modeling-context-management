/**
 * 管线二：每周用户特质生成
 *
 * 产出 → user_profiles.pattern_layer:
 *   内在特质和思想模式（褒义描述）
 *
 * 数据来源: 近 N 天的 user_internal_info 胶囊 + 上一版画像
 * 模型:     DeepSeek Pro（默认 deepseek-v4-pro）
 *
 * 与管线一（daily-profile）的区别:
 *   - 只读内在信息胶囊，不读经历胶囊
 *   - 输出单一标签 <pattern_layer>
 *   - 聚焦于"这个人是谁"而非"这个人在做什么"
 */

import { callDeepSeek } from './llm-client';

// ============================================================
// Prompt 模板
// ============================================================

const TRAITS_PROMPT = `你是一个"用户数字孪生"构建系统。你的任务是通过分析用户的对话数据，构建一个的用户画像。

【输入】
历史对话数据：
{HISTORY}

用户画像：
{PROFILE}

【输出】
内在特质和思想（这个人最特别，最个性的特质，和这个人最重要的思想。都要求是褒义的，而非负面的。）

---

【输出样式】：
把输出放进 <pattern layer> 标签里。`;

// ============================================================
// 类型
// ============================================================

export interface WeeklyTraitsInput {
  userId: string;
  apiKey: string;
  internalCapsules: InternalCapsuleRecord[];
  previousRawContent?: string | null;
  model?: string;
}

interface InternalCapsuleRecord {
  content: string;
  topic_tag: string[] | string;
  significance: number;
  supporting_quotes?: string[];
  created_at: string;
}

export interface WeeklyTraitsOutput {
  patternLayer: string;
  rawLlmOutput: string;
}

// ============================================================
// 数据组装
// ============================================================

function buildTraitsHistoryContent(
  capsules: InternalCapsuleRecord[],
): string {
  const parts: string[] = [];
  parts.push('## 用户内在信息汇总');
  parts.push(`共 ${capsules.length} 条内在信息：\n`);

  capsules.forEach((info, index) => {
    const ts = new Date(info.created_at).toLocaleString('zh-CN');
    const tags = Array.isArray(info.topic_tag)
      ? info.topic_tag.join(', ')
      : info.topic_tag;
    const quotes =
      info.supporting_quotes && Array.isArray(info.supporting_quotes)
        ? info.supporting_quotes.join(' | ')
        : '';

    parts.push(
      `【内在信息 ${index + 1}】${ts}\n重要性: ${info.significance}/10\n标签: ${tags}\n内容: ${info.content}\n支撑原话: ${quotes}`,
    );
  });

  return parts.join('\n\n');
}

// ============================================================
// 标签解析
// ============================================================

function extractPatternLayer(content: string): string {
  // 支持 <pattern_layer> 和 <pattern layer> 两种写法（LLM 有时输出带空格的变体）
  const patterns = [
    /<pattern_layer>([\s\S]*?)<\/pattern_layer>/i,
    /<pattern layer>([\s\S]*?)<\/pattern layer>/i,
  ];

  for (const p of patterns) {
    const match = content.match(p);
    if (match) return match[1].trim();
  }

  return content.trim();
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 运行管线二：生成用户内在特质。
 *
 * 不直接操作数据库 — 调用方负责查询胶囊和保存结果。
 */
export async function generateWeeklyTraits(
  input: WeeklyTraitsInput,
): Promise<WeeklyTraitsOutput> {
  const {
    apiKey,
    internalCapsules,
    previousRawContent,
    model = 'deepseek-v4-pro',
  } = input;

  console.log(
    `[weekly-traits] Generating traits from ${internalCapsules.length} internal info capsules`,
  );

  if (internalCapsules.length === 0) {
    throw new Error('[weekly-traits] No internal info capsules provided');
  }

  const historyContent = buildTraitsHistoryContent(internalCapsules);

  const prompt = TRAITS_PROMPT
    .replace('{HISTORY}', historyContent)
    .replace('{PROFILE}', previousRawContent || '无历史画像');

  // temperature=1：特质生成需要表达上的多样性，避免每次输出模板化描述
  // 与管线一（事实层，不设 temperature）不同——事实要精确，特质要有个性
  const llmOutput = await callDeepSeek(prompt, apiKey, model, {
    maxTokens: 4000,
    temperature: 1,
  });

  const patternLayer = extractPatternLayer(llmOutput);

  console.log(
    `[weekly-traits] Generated pattern_layer: ${patternLayer.length} chars`,
  );

  return {
    patternLayer,
    rawLlmOutput: llmOutput,
  };
}
