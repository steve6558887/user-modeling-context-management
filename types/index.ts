/**
 * 用户建模管线 — 核心类型定义
 */

// ============================================================
// 对话消息
// ============================================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ============================================================
// 胶囊提取输出
// ============================================================

/** 经历胶囊 — 用户与他者/世界的交互 */
export interface ExperienceCapsule {
  narrative: string;       // 第三人称：极高信息密度叙述，还原99%事实
  topic_tag: string[];     // 第一人称视角+充分信息的关键词
  significance: number;    // 重要性 1-10
  key_quotes: string[];    // 用户最具代表性的2-3句话
}

/** 内在信息胶囊 — 用户的价值观、世界观、偏好、思想 */
export interface InternalInfoCapsule {
  content: string;         // 内在信息的具体内容
  topic_tag: string[];     // 便于检索的关键词
  significance: number;    // 重要性 1-10
  key_quotes: string[];    // 用户表达这个内在信息的关键原话
}

export interface MemoryCapsulesDirectResponse {
  experiences: ExperienceCapsule[];
  internal_infos: InternalInfoCapsule[];
}

// ============================================================
// 检索
// ============================================================

export interface MemorySearchRequest {
  user_id: string;
  character_id?: string;
  query_text: string;
  query_vector?: number[];
  entity_keywords?: string[];
  match_count?: number;
  match_threshold?: number;
}

export interface MemorySearchResult {
  id: string;
  capsule_id: string;
  user_id: string;
  character_id: string;
  significance: number;
  narrative?: string;
  content?: string;
  topic_tag: string[];
  key_quotes?: string[];
  verbatim_quotes?: string[];
  supporting_quotes?: string[];
  semantic_vector: number[];
  similarity?: number;
  entity_score?: number;
  vector_score?: number;
  final_score?: number;
  created_at?: string;
  event_timestamp?: string;
}

export interface MemorySearchResponse {
  success: boolean;
  results: MemorySearchResult[];
  total_count: number;
  error?: string;
}

// ============================================================
// 用户画像
// ============================================================

export interface UserProfile {
  user_id: string;
  fact_layer: string;        // 管线一产出：基本信息
  pattern_layer: string;     // 管线二产出：内在特质/思想模式
  current_status: string;    // 管线一产出：当下状态（3个月尺度）
  project_status: string;    // 管线一产出：项目状况
  raw_content: string;       // DB 触发器自动合并
  generated_at: string;
  updated_at: string;
}

export interface UserTraits {
  user_id: string;
  generated_at: string;
  raw_content: string;
  pattern_layer?: string;
  capsule_count: number;
}

// ============================================================
// 配置
// ============================================================

export interface PipelineConfig {
  /** Supabase 连接 */
  supabaseUrl: string;
  supabaseServiceKey: string;

  /** 胶囊提取 */
  extractorModel: string;       // 默认 'deepseek-v4-flash'
  embeddingModel: string;       // 默认 'text-embedding-v3'
  embeddingDimensions: number;  // 默认 1024
  embeddingProvider: 'qwen';    // 目前仅支持 Qwen (阿里云 DashScope)

  /** 检索权重 */
  retrieval: {
    entityWeight: number;       // 默认 0.7
    vectorWeight: number;       // 默认 0.2
    significanceWeight: number; // 默认 0.1
    matchThreshold: number;     // 默认 0.7
    matchCount: number;         // 默认 5
  };

  /** 画像生成 */
  profileDaysLookback: number;  // 管线一：15天
  traitsDaysLookback: number;   // 管线二：20天
  profileModel: string;         // 默认 'deepseek-v4-pro'
  traitsModel: string;          // 默认 'deepseek-v4-pro'
}
