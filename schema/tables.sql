-- ============================================================
-- 用户建模管线 — 数据库表定义
-- 依赖: Supabase pgvector 扩展 (vector 类型 + HNSW 索引)
-- ============================================================

-- 确保 pgvector 扩展已启用
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. 用户经历表 — 用户与他者/世界的交互
-- ============================================================

CREATE TABLE IF NOT EXISTS user_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL DEFAULT 'default',

    -- 核心内容
    narrative TEXT NOT NULL,           -- 第三人称：信息密度极高的叙述
    topic_tag TEXT[] NOT NULL DEFAULT '{}',  -- 第一人称视角关键词数组
    significance INTEGER NOT NULL CHECK (significance >= 1 AND significance <= 10),
    key_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 语义向量 (用于混合搜索)
    semantic_vector vector(1024),

    -- 时间
    event_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_experiences_user
    ON user_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_experiences_user_char
    ON user_experiences(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_user_experiences_significance
    ON user_experiences(significance DESC);
CREATE INDEX IF NOT EXISTS idx_user_experiences_created_at
    ON user_experiences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_experiences_topic_tag
    ON user_experiences USING GIN(topic_tag);

-- 向量索引 (HNSW, cosine 距离)
CREATE INDEX IF NOT EXISTS idx_user_experiences_vector
    ON user_experiences
    USING hnsw (semantic_vector vector_cosine_ops);

-- ============================================================
-- 2. 用户内在信息表 — 价值观、世界观、偏好、思想
-- ============================================================

CREATE TABLE IF NOT EXISTS user_internal_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    character_id TEXT NOT NULL DEFAULT 'default',

    -- 核心内容
    content TEXT NOT NULL,             -- 内在信息的具体内容
    topic_tag TEXT[] NOT NULL DEFAULT '{}',  -- 检索关键词数组
    significance INTEGER NOT NULL CHECK (significance >= 1 AND significance <= 10),
    supporting_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- 语义向量
    semantic_vector vector(1024),

    -- 时间
    event_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_user_internal_info_user
    ON user_internal_info(user_id);
CREATE INDEX IF NOT EXISTS idx_user_internal_info_user_char
    ON user_internal_info(user_id, character_id);
CREATE INDEX IF NOT EXISTS idx_user_internal_info_significance
    ON user_internal_info(significance DESC);
CREATE INDEX IF NOT EXISTS idx_user_internal_info_created_at
    ON user_internal_info(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_internal_info_topic_tag
    ON user_internal_info USING GIN(topic_tag);

CREATE INDEX IF NOT EXISTS idx_user_internal_info_vector
    ON user_internal_info
    USING hnsw (semantic_vector vector_cosine_ops);

-- ============================================================
-- 3. 用户画像表 — 持续更新的用户数字孪生
-- ============================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,

    -- 管线一产出（每日）
    fact_layer TEXT,              -- 基本信息：年龄、职业、目标
    project_status TEXT,          -- 项目：名称、阶段、进展、困难
    current_status TEXT,          -- 当下状态（3个月尺度）+ 最近活动

    -- 管线二产出（每周）
    pattern_layer TEXT,           -- 内在特质和思想模式

    -- 自动合并字段（由触发器维护）
    raw_content TEXT,

    -- 时间
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user_id
    ON user_profiles(user_id);

COMMENT ON TABLE user_profiles IS '用户数字孪生 — 持续更新的用户模型';
COMMENT ON COLUMN user_profiles.fact_layer IS '管线一产出：事实层基本信息';
COMMENT ON COLUMN user_profiles.project_status IS '管线一产出：项目状况';
COMMENT ON COLUMN user_profiles.current_status IS '管线一产出：当下状态';
COMMENT ON COLUMN user_profiles.pattern_layer IS '管线二产出：内在特质/思想模式';
COMMENT ON COLUMN user_profiles.raw_content IS '触发器自动合并 fact_layer + pattern_layer';
