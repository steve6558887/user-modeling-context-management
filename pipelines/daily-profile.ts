/**
 * 管线一：每日用户画像生成
 *
 * 产出 → user_profiles 表:
 *   - fact_layer:      基本信息（年龄、职业、目标）
 *   - project_status:  项目名称、阶段、进展、困难、下一步
 *   - current_status:  当下状态（3个月尺度）+ 最近活动
 *
 * 数据来源: 近 N 天的 user_experiences + user_internal_info 胶囊
 * 模型:     DeepSeek Pro（默认 deepseek-v4-pro）
 */

import { callDeepSeek } from './llm-client';

// ============================================================
// Prompt 模板
// ============================================================

const PROFILE_PROMPT = `你是一个"用户数字孪生"构建系统。你的任务是通过分析用户的对话数据，构建一个的用户画像。

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
- 必须严格遵守标签格式，以便系统解析。`;

// ============================================================
// 类型
// ============================================================

export interface DailyProfileInput {
  userId: string;
  apiKey: string;
  experiences: CapsuleRecord[];
  internalInfos: CapsuleRecord[];
  previousRawContent?: string | null;
  memoryPlus?: string;
  model?: string;
}

interface CapsuleRecord {
  narrative?: string;
  content?: string;
  topic_tag: string[] | string;
  significance: number;
  key_quotes?: string[];
  supporting_quotes?: string[];
  created_at: string;
}

export interface DailyProfileOutput {
  factLayer: string;
  projectStatus: string;
  currentStatus: string;
  rawLlmOutput: string;
}

// ============================================================
// 数据组装
// ============================================================

function buildHistoryContent(
  experiences: CapsuleRecord[],
  internalInfos: CapsuleRecord[],
): string {
  const parts: string[] = [];

  if (experiences.length > 0) {
    parts.push('## 近期经历\n');
    experiences.forEach((e) => {
      const ts = new Date(e.created_at).toLocaleString('zh-CN');
      const tags = Array.isArray(e.topic_tag)
        ? e.topic_tag.join(', ')
        : e.topic_tag;
      const quotes =
        e.key_quotes && Array.isArray(e.key_quotes)
          ? e.key_quotes.join('; ')
          : '';

      parts.push(
        `【经历】${ts}\n重要性: ${e.significance}/10\n主题: ${tags}\n叙事: ${e.narrative || ''}\n关键原话: ${quotes}`,
      );
    });
  }

  if (internalInfos.length > 0) {
    parts.push('\n## 近期内在信息\n');
    internalInfos.forEach((i) => {
      const ts = new Date(i.created_at).toLocaleString('zh-CN');
      const tags = Array.isArray(i.topic_tag)
        ? i.topic_tag.join(', ')
        : i.topic_tag;

      parts.push(
        `【内在】${ts}\n重要性: ${i.significance}/10\n主题: ${tags}\n内容: ${i.content || ''}`,
      );
    });
  }

  return parts.join('\n\n');
}

// ============================================================
// 标签解析
// ============================================================

function extractTag(content: string, tag: string): string {
  // 支持 <tag> 和 <tag layer> 两种写法（LLM 有时输出带空格的变体）
  const patterns = [
    new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'),
    new RegExp(`<${tag.replace('_', ' ')}>([\\s\\S]*?)<\\/${tag.replace('_', ' ')}>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 运行管线一：生成今日用户画像。
 *
 * 不直接操作数据库 — 调用方负责查询胶囊和保存结果。
 * 纯函数设计，便于测试和替换 LLM provider。
 */
export async function generateDailyProfile(
  input: DailyProfileInput,
): Promise<DailyProfileOutput> {
  const {
    apiKey,
    experiences,
    internalInfos,
    previousRawContent,
    memoryPlus,
    model = 'deepseek-v4-pro',
  } = input;

  console.log(
    `[daily-profile] Generating profile from ${experiences.length} experiences, ${internalInfos.length} internal infos`,
  );

  const historyContent = buildHistoryContent(experiences, internalInfos);

  const prompt = PROFILE_PROMPT
    .replace('{HISTORY}', historyContent || '无近期记忆胶囊')
    .replace('{PROFILE}', previousRawContent || '无历史画像（首次生成）')
    .replace('{PLUS}', memoryPlus || '无记忆补充');

  const llmOutput = await callDeepSeek(prompt, apiKey, model, { maxTokens: 8000 });

  const factLayer = extractTag(llmOutput, 'fact_layer') || llmOutput;
  const projectStatus = extractTag(llmOutput, 'project_status');
  const currentStatus = extractTag(llmOutput, 'current_status');

  console.log(
    `[daily-profile] Generated: fact=${factLayer.length}ch, project=${projectStatus.length}ch, current=${currentStatus.length}ch`,
  );

  return {
    factLayer,
    projectStatus,
    currentStatus,
    rawLlmOutput: llmOutput,
  };
}
