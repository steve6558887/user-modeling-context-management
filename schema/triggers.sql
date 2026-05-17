-- ============================================================
-- 用户建模管线 — 触发器与自动化
-- ============================================================

-- ============================================================
-- raw_content 自动合并触发器
-- 当 fact_layer 或 pattern_layer 更新时，自动重建 raw_content
-- ============================================================

CREATE OR REPLACE FUNCTION update_raw_content()
RETURNS TRIGGER AS $$
BEGIN
    NEW.raw_content := CONCAT_WS(
        E'\n\n',
        CASE
            WHEN NEW.fact_layer IS NOT NULL AND NEW.fact_layer != ''
            THEN CONCAT('<fact layer>\n', NEW.fact_layer, '\n</fact layer>')
            ELSE NULL
        END,
        CASE
            WHEN NEW.pattern_layer IS NOT NULL AND NEW.pattern_layer != ''
            THEN CONCAT('<pattern layer>\n', NEW.pattern_layer, '\n</pattern layer>')
            ELSE NULL
        END
    );

    -- 自动更新时间戳
    NEW.updated_at := NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除旧触发器（如果存在）后重建
DROP TRIGGER IF EXISTS trigger_update_raw_content ON user_profiles;

CREATE TRIGGER trigger_update_raw_content
    BEFORE INSERT OR UPDATE OF fact_layer, pattern_layer ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_raw_content();

-- ============================================================
-- updated_at 自动更新触发器
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为胶囊表添加自动时间戳触发器
DROP TRIGGER IF EXISTS trigger_update_experiences_timestamp ON user_experiences;
CREATE TRIGGER trigger_update_experiences_timestamp
    BEFORE UPDATE ON user_experiences
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_internal_info_timestamp ON user_internal_info;
CREATE TRIGGER trigger_update_internal_info_timestamp
    BEFORE UPDATE ON user_internal_info
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_profiles_timestamp ON user_profiles;
CREATE TRIGGER trigger_update_profiles_timestamp
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
