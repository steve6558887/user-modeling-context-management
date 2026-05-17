/**
 * 混合检索服务
 *
 * 三元加权检索：实体匹配 (ILIKE topic_tag + narrative) +
 *               向量相似度 (cosine) +
 *               重要性 (significance)
 *
 * 默认权重: entity=0.7, vector=0.2, significance=0.1
 * 默认阈值: 0.7
 *
 * 依赖 Supabase 客户端调用 PostgreSQL RPC 函数（schema/hybrid-search.sql）
 */

import type { MemorySearchResult } from '../types';
import type { EmbeddingProvider } from './embedding';
import { extractKeywords } from './keyword-extractor';

// ============================================================
// 类型
// ============================================================

export interface SupabaseClient {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{
    data: Array<Record<string, unknown>> | null;
    error: unknown;
  }>;
}

export interface HybridSearchInput {
  supabase: SupabaseClient;
  embeddingProvider: EmbeddingProvider;
  userId: string;
  queryText: string;
  queryVector?: number[];
  characterId?: string;
  matchCount?: number;
  matchThreshold?: number;
  entityWeight?: number;
  vectorWeight?: number;
  significanceWeight?: number;
}

// ============================================================
// 公开 API
// ============================================================

export async function hybridSearch(
  input: HybridSearchInput,
): Promise<MemorySearchResult[]> {
  const {
    supabase,
    embeddingProvider,
    userId,
    queryText,
    queryVector,
    characterId,
    matchCount = 5,
    matchThreshold = 0.7,
    entityWeight = 0.7,
    vectorWeight = 0.2,
    significanceWeight = 0.1,
  } = input;

  // 1. 提取关键词
  const entityKeywords = extractKeywords(queryText);

  // 2. 获取/使用 embedding
  const vector =
    queryVector || (await embeddingProvider.generateEmbedding(queryText));

  // 3. 并行查询两种胶囊
  const [expResult, intResult] = await Promise.all([
    supabase.rpc('search_user_experiences_hybrid', {
      p_query_vector: vector,
      p_entity_keywords: entityKeywords,
      p_user_id: userId,
      p_character_id: characterId || null,
      p_match_threshold: matchThreshold,
      p_entity_weight: entityWeight,
      p_vector_weight: vectorWeight,
      p_significance_weight: significanceWeight,
      p_match_count: matchCount,
    }),
    supabase.rpc('search_user_internal_info_hybrid', {
      p_query_vector: vector,
      p_entity_keywords: entityKeywords,
      p_user_id: userId,
      p_character_id: characterId || null,
      p_match_threshold: matchThreshold,
      p_entity_weight: entityWeight,
      p_vector_weight: vectorWeight,
      p_significance_weight: significanceWeight,
      p_match_count: matchCount,
    }),
  ]);

  // 4. 合并 & 排序
  const allResults: MemorySearchResult[] = [];

  const merge = (data: Array<Record<string, unknown>> | null, type: string) => {
    if (!data || !Array.isArray(data)) return;
    for (const item of data) {
      allResults.push({
        ...(item as unknown as MemorySearchResult),
        capsule_id: (item as Record<string, unknown>).id as string,
      });
    }
  };

  if (!expResult.error) merge(expResult.data, 'user_experience');
  if (!intResult.error) merge(intResult.data, 'user_internal_info');

  // 按 final_score 降序
  allResults.sort(
    (a, b) => (b.final_score || 0) - (a.final_score || 0),
  );

  return allResults.slice(0, matchCount);
}
