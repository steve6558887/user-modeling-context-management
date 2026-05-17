/**
 * 上下文组装器
 *
 * 将三个信息源组装为注入 LLM 对话的上下文块：
 *   1. 用户画像（从 user_profiles 读取，由管线一/二产出）
 *   2. 长期记忆（从胶囊检索返回）
 *   3. 工作记忆（从 Session 读取，近几轮的压缩摘要）
 *
 * 设计原则：用户画像是静态层（可缓存），长期记忆是动态层（每次检索不同），
 * 工作记忆是状态层（跟随对话轮次变化）。
 */

import type { MemorySearchResult } from '../types';

// ============================================================
// 类型
// ============================================================

export interface AssembledContext {
  /** 用户画像块（静态，可被 prompt cache 复用） */
  userProfileBlock: string;
  /** 长期记忆块（动态，每次检索不同） */
  longTermMemoryBlock: string;
  /** 工作记忆块（随对话轮次变化） */
  workingMemoryBlock: string;
  /** 完整合并的上下文 */
  fullContext: string;
}

export interface WorkingMemoryEntry {
  roundNumber: number;
  content: string;
}

export interface ContextAssemblerInput {
  userProfile?: {
    factLayer?: string;
    patternLayer?: string;
    currentStatus?: string;
    projectStatus?: string;
    nickname?: string;
  } | null;
  longTermMemories?: MemorySearchResult[];
  workingMemoryEntries?: WorkingMemoryEntry[];
}

// ============================================================
// 用户画像块
// ============================================================

function assembleUserProfileBlock(
  profile: ContextAssemblerInput['userProfile'],
): string {
  if (!profile) return '';

  const layers: string[] = [];

  if (profile.factLayer) {
    layers.push(`【事实层】\n${profile.factLayer}`);
  }
  if (profile.patternLayer) {
    layers.push(`【模式层】\n${profile.patternLayer}`);
  }
  if (profile.currentStatus) {
    layers.push(`【当前状态】\n${profile.currentStatus}`);
  }
  if (profile.projectStatus) {
    layers.push(`【项目状况】\n${profile.projectStatus}`);
  }

  if (layers.length === 0) return '';

  const header = profile.nickname
    ? `【User Profile — ${profile.nickname}】`
    : '【User Profile】';

  return `\n---\n${header}\n${layers.join('\n\n')}`;
}

// ============================================================
// 长期记忆块
// ============================================================

function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const target = new Date(timestamp);
  const diffMs = now.getTime() - target.getTime();

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears} years ago`;
  if (diffMonths > 0) return `${diffMonths} months ago`;
  if (diffWeeks > 0) return `${diffWeeks} weeks ago`;
  if (diffDays > 0) return `${diffDays} days ago`;
  return 'Today';
}

function assembleLongTermMemoryBlock(
  memories: MemorySearchResult[],
): string {
  if (!memories || memories.length === 0) return '';

  const blocks = memories.map((m) => {
    const ts = m.created_at || m.event_timestamp || '';
    const relativeTime = ts ? getRelativeTime(ts) : 'Unknown';
    const significance = m.significance || 5;
    const narrative = m.narrative || m.content || '';
    const quotes = m.key_quotes || m.verbatim_quotes || m.supporting_quotes || [];
    const quoteStr = quotes.length > 0 ? quotes.slice(0, 2).join('; ') : '';

    let block = `[${relativeTime}] [sig:${significance}/10] `;
    if (narrative) block += narrative;
    if (quoteStr) block += ` — "${quoteStr}"`;
    return block;
  });

  return `【Long-term Memories】\n${blocks.join('\n')}`;
}

// ============================================================
// 工作记忆块
// ============================================================

function assembleWorkingMemoryBlock(
  entries: WorkingMemoryEntry[],
): string {
  if (!entries || entries.length === 0) return '(No working memory yet)';

  const blocks = entries.map(
    (e) => `[Round ${e.roundNumber}] ${e.content}`,
  );
  return `【Working Memory】\n${blocks.join('\n')}`;
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 组装完整上下文。每块可独立使用（配合 prompt cache）或合并注入。
 */
export function assembleContext(input: ContextAssemblerInput): AssembledContext {
  const userProfileBlock = assembleUserProfileBlock(input.userProfile);
  const longTermMemoryBlock = assembleLongTermMemoryBlock(input.longTermMemories || []);
  const workingMemoryBlock = assembleWorkingMemoryBlock(input.workingMemoryEntries || []);

  const fullContext = [userProfileBlock, longTermMemoryBlock, workingMemoryBlock]
    .filter(Boolean)
    .join('\n\n');

  return {
    userProfileBlock,
    longTermMemoryBlock,
    workingMemoryBlock,
    fullContext,
  };
}

/**
 * 便捷函数：只组装用户画像块（用于 prompt cache 的静态层）。
 * 这个块在一次对话中不变，可以安全地放在 cache_control 断点之前。
 */
export function assembleStaticLayer(
  profile: ContextAssemblerInput['userProfile'],
): string {
  return assembleUserProfileBlock(profile);
}

/**
 * 便捷函数：只组装动态层（长期记忆 + 工作记忆）。
 */
export function assembleDynamicLayer(
  memories?: MemorySearchResult[],
  workingMemories?: WorkingMemoryEntry[],
): string {
  const memoryBlock = assembleLongTermMemoryBlock(memories || []);
  const wmBlock = assembleWorkingMemoryBlock(workingMemories || []);
  return [memoryBlock, wmBlock].filter(Boolean).join('\n\n');
}
