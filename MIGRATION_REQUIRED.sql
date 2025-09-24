-- ⚠️ 이 SQL을 Supabase 대시보드의 SQL Editor에서 실행하세요!
-- 15분 간격에서 1분 간격으로 마이그레이션

-- 1. 백업 테이블 생성
CREATE TABLE IF NOT EXISTS token_price_history_backup AS 
SELECT * FROM token_price_history;

-- 2. 컬럼명 변경
ALTER TABLE token_price_history 
RENAME COLUMN timestamp_15min TO timestamp_1min;

-- 3. 인덱스 재생성
DROP INDEX IF EXISTS idx_token_timestamp;
DROP INDEX IF EXISTS idx_timestamp_desc;

CREATE INDEX idx_token_timestamp ON token_price_history (token_address, timestamp_1min);
CREATE INDEX idx_timestamp_desc ON token_price_history (timestamp_1min DESC);

-- 4. 정리 함수 업데이트 (60개만 유지)
CREATE OR REPLACE FUNCTION cleanup_old_price_history()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM token_price_history 
    WHERE token_address = NEW.token_address 
    AND timestamp_1min NOT IN (
        SELECT timestamp_1min 
        FROM token_price_history 
        WHERE token_address = NEW.token_address 
        ORDER BY timestamp_1min DESC 
        LIMIT 60
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 1분 정규화 함수 생성
CREATE OR REPLACE FUNCTION normalize_to_1min(input_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN date_trunc('minute', input_timestamp);
END;
$$ LANGUAGE plpgsql;

-- 6. 기존 15분 정규화 함수 삭제
DROP FUNCTION IF EXISTS normalize_to_15min(TIMESTAMP WITH TIME ZONE);

-- 7. 트리거 재생성
DROP TRIGGER IF EXISTS cleanup_price_history_trigger ON token_price_history;

CREATE TRIGGER cleanup_price_history_trigger
    AFTER INSERT ON token_price_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_price_history();

-- 8. 기존 데이터 정리 (각 토큰별 최신 60개만 유지)
WITH ranked_data AS (
    SELECT id,
           token_address,
           ROW_NUMBER() OVER (PARTITION BY token_address ORDER BY timestamp_1min DESC) as rn
    FROM token_price_history
)
DELETE FROM token_price_history
WHERE id IN (
    SELECT id FROM ranked_data WHERE rn > 60
);

-- 9. 완료 확인
SELECT 
    '마이그레이션 완료!' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT token_address) as unique_tokens
FROM token_price_history;