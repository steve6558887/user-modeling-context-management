-- ============================================================
-- 用户建模管线 — 混合检索 PostgreSQL 函数
--
-- 三元加权：实体匹配 (entity) + 向量相似度 (vector) + 重要性 (significance)
-- 默认权重: entity=0.7, vector=0.2, significance=0.1
-- 这些权重在应用层作为参数传入，可调。
-- ============================================================

-- ============================================================
-- 1. 经历表混合搜索
-- ============================================================

CREATE OR REPLACE FUNCTION search_user_experiences_hybrid(
    p_query_vector vector(1024),
    p_entity_keywords TEXT[],
    p_user_id TEXT,
    p_character_id TEXT DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.6,
    p_entity_weight FLOAT DEFAULT 0.7,
    p_vector_weight FLOAT DEFAULT 0.2,
    p_significance_weight FLOAT DEFAULT 0.1,
    p_match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    character_id TEXT,
    narrative TEXT,
    topic_tag TEXT[],
    significance INTEGER,
    key_quotes JSONB,
    semantic_vector vector(1024),
    created_at TIMESTAMP WITH TIME ZONE,
    entity_score FLOAT,
    vector_score FLOAT,
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.user_id,
        e.character_id,
        e.narrative,
        e.topic_tag,
        e.significance,
        e.key_quotes,
        e.semantic_vector,
        e.created_at,
        -- 实体匹配分数 (0-2)
        (
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM unnest(e.topic_tag) as tag
                    WHERE tag ILIKE ANY (p_entity_keywords)
                ) THEN 1.0 ELSE 0.0 END +
            CASE
                WHEN e.narrative ILIKE ANY (
                    SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
                ) THEN 1.0 ELSE 0.0 END
        )::FLOAT as entity_score,
        -- 向量相似度 (0-1)
        (1.0 - (e.semantic_vector <=> p_query_vector))::FLOAT as vector_score,
        -- 综合分数
        (
            (
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(e.topic_tag) as tag
                        WHERE tag ILIKE ANY (p_entity_keywords)
                    ) THEN 1.0 ELSE 0.0 END +
                CASE
                    WHEN e.narrative ILIKE ANY (
                        SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
                    ) THEN 1.0 ELSE 0.0 END
            ) * p_entity_weight +
            (1.0 - (e.semantic_vector <=> p_query_vector)) * p_vector_weight +
            (e.significance / 10.0) * p_significance_weight
        )::FLOAT as final_score
    FROM user_experiences e
    WHERE e.user_id = p_user_id
        AND (p_character_id IS NULL OR e.character_id = p_character_id)
        AND (
            -- 至少满足一个条件：实体匹配 或 向量相似度达标
            EXISTS (
                SELECT 1 FROM unnest(e.topic_tag) as tag
                WHERE tag ILIKE ANY (p_entity_keywords)
            ) OR
            e.narrative ILIKE ANY (
                SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
            ) OR
            (1.0 - (e.semantic_vector <=> p_query_vector)) >= p_match_threshold
        )
    ORDER BY final_score DESC
    LIMIT p_match_count;
END;
$$;

-- ============================================================
-- 2. 内在信息表混合搜索
-- ============================================================

CREATE OR REPLACE FUNCTION search_user_internal_info_hybrid(
    p_query_vector vector(1024),
    p_entity_keywords TEXT[],
    p_user_id TEXT,
    p_character_id TEXT DEFAULT NULL,
    p_match_threshold FLOAT DEFAULT 0.6,
    p_entity_weight FLOAT DEFAULT 0.7,
    p_vector_weight FLOAT DEFAULT 0.2,
    p_significance_weight FLOAT DEFAULT 0.1,
    p_match_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id TEXT,
    character_id TEXT,
    content TEXT,
    topic_tag TEXT[],
    significance INTEGER,
    supporting_quotes JSONB,
    semantic_vector vector(1024),
    created_at TIMESTAMP WITH TIME ZONE,
    entity_score FLOAT,
    vector_score FLOAT,
    final_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.id,
        i.user_id,
        i.character_id,
        i.content,
        i.topic_tag,
        i.significance,
        i.supporting_quotes,
        i.semantic_vector,
        i.created_at,
        (
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM unnest(i.topic_tag) as tag
                    WHERE tag ILIKE ANY (p_entity_keywords)
                ) THEN 1.0 ELSE 0.0 END +
            CASE
                WHEN i.content ILIKE ANY (
                    SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
                ) THEN 1.0 ELSE 0.0 END
        )::FLOAT as entity_score,
        (1.0 - (i.semantic_vector <=> p_query_vector))::FLOAT as vector_score,
        (
            (
                CASE
                    WHEN EXISTS (
                        SELECT 1 FROM unnest(i.topic_tag) as tag
                        WHERE tag ILIKE ANY (p_entity_keywords)
                    ) THEN 1.0 ELSE 0.0 END +
                CASE
                    WHEN i.content ILIKE ANY (
                        SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
                    ) THEN 1.0 ELSE 0.0 END
            ) * p_entity_weight +
            (1.0 - (i.semantic_vector <=> p_query_vector)) * p_vector_weight +
            (i.significance / 10.0) * p_significance_weight
        )::FLOAT as final_score
    FROM user_internal_info i
    WHERE i.user_id = p_user_id
        AND (p_character_id IS NULL OR i.character_id = p_character_id)
        AND (
            EXISTS (
                SELECT 1 FROM unnest(i.topic_tag) as tag
                WHERE tag ILIKE ANY (p_entity_keywords)
            ) OR
            i.content ILIKE ANY (
                SELECT '%' || keyword || '%' FROM unnest(p_entity_keywords) as keyword
            ) OR
            (1.0 - (i.semantic_vector <=> p_query_vector)) >= p_match_threshold
        )
    ORDER BY final_score DESC
    LIMIT p_match_count;
END;
$$;

-- ============================================================
-- 注释
-- ============================================================

COMMENT ON FUNCTION search_user_experiences_hybrid IS
    '混合检索用户经历：实体匹配 (ILIKE topic_tag + narrative) + 向量余弦相似度 + 重要性加权';

COMMENT ON FUNCTION search_user_internal_info_hybrid IS
    '混合检索用户内在信息：实体匹配 (ILIKE topic_tag + content) + 向量余弦相似度 + 重要性加权';
